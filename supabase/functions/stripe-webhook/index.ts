import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.11.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-11-20.acacia",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    console.log("Webhook received:", {
      hasSignature: !!signature,
      hasSecret: !!webhookSecret,
    });

    let event: Stripe.Event;

    const body = await req.text();

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret
        );
        console.log("✅ Signature verified successfully");
      } catch (err: any) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return new Response(
          JSON.stringify({ error: "Webhook signature verification failed", details: err.message }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      console.log("⚠️ No signature verification - processing without verification");
      event = JSON.parse(body);
    }

    console.log("Processing webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer as string;

        console.log("✅ Webhook: checkout.session.completed", {
          userId,
          customerId,
          subscriptionId: session.subscription,
          paymentStatus: session.payment_status,
        });

        if (!userId) {
          console.error("❌ Missing user_id in session metadata");
          break;
        }

        if (!session.subscription) {
          console.error("❌ No subscription in checkout session");
          break;
        }

        const { data: subData, error: subError } = await supabase
          .from("user_subscriptions")
          .update({
            subscription_tier: "premium",
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select();

        if (subError) {
          console.error("❌ Subscription update failed:", subError);
        } else {
          console.log("✅ Subscription updated:", subData);
        }

        const { data: flagData, error: flagError } = await supabase
          .from("user_feature_flags")
          .update({
            can_access_tournaments: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select();

        if (flagError) {
          console.error("❌ Feature flags update failed:", flagError);
        } else {
          console.log("✅ Feature flags updated:", flagData);
        }

        const { data: statsData, error: statsError } = await supabase
          .from("user_usage_stats")
          .update({
            players_created: 0,
            match_results_created: 0,
            shares_created: 0,
            live_shares_created: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select();

        if (statsError) {
          console.error("❌ Usage stats reset failed:", statsError);
        } else {
          console.log("✅ Usage stats reset:", statsData);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log("Subscription created:", { customerId, subscriptionId: subscription.id });

        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        console.log("Found user:", userSub);

        if (userSub) {
          const updateData: any = {
            subscription_tier: "premium",
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          };

          if (subscription.current_period_start) {
            updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
          }
          if (subscription.current_period_end) {
            updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
          }

          const { error: subError } = await supabase
            .from("user_subscriptions")
            .update(updateData)
            .eq("user_id", userSub.user_id);

          console.log("Subscription tier update result:", { error: subError });

          const { error: flagError } = await supabase
            .from("user_feature_flags")
            .update({
              can_access_tournaments: true,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id);

          console.log("Feature flags update result:", { error: flagError });

          const { error: statsError } = await supabase
            .from("user_usage_stats")
            .update({
              players_created: 0,
              match_results_created: 0,
              shares_created: 0,
              live_shares_created: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id);

          console.log("Usage stats reset result:", { error: statsError });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userSub) {
          const updateData: any = {
            subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          };

          if (subscription.current_period_start) {
            updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
          }
          if (subscription.current_period_end) {
            updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
          }

          await supabase
            .from("user_subscriptions")
            .update(updateData)
            .eq("user_id", userSub.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userSub) {
          await supabase
            .from("user_subscriptions")
            .update({
              subscription_tier: "free",
              subscription_status: "cancelled",
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id);

          await supabase
            .from("user_feature_flags")
            .update({
              can_access_tournaments: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});