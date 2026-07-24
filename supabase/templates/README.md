# Supabase Email Templates

Custom branded email templates for authentication flows.

## Templates Included

1. **confirmation.html** - Email confirmation for new signups
2. **invite.html** - User invitation emails
3. **recovery.html** - Password reset emails
4. **magic_link.html** - Magic link authentication
5. **email_change.html** - Email address change confirmation

## Features

- Dark theme matching the app design (#0a1526 background)
- Neon green (#C8F135) accent colors
- Responsive design
- Logo rendered as inline SVG matching `public/logo.svg` + the "myTenniStats" wordmark used in the app header (no external image request, so it can't break in an inbox)
- Professional gradient backgrounds
- Hover effects on CTA buttons
- Security warnings for sensitive actions
- Fallback plain-text links

## Supabase Template Variables

All templates use the standard Supabase variable:
- `{{ .ConfirmationURL }}` - The action URL (confirmation, reset, login, etc.)

## How to Use

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the template type (Confirm signup, Magic Link, etc.)
4. Copy the HTML content from the corresponding file
5. Paste it into the template editor
6. Save changes

### Option 2: Via Supabase CLI

```bash
# Deploy all email templates
supabase db remote commit

# Or manually upload via the API
```

## Customization

To customize the templates:

1. **Logo**: rendered inline as `<svg>` markup (circle mark) + a `myTenniStats` text lockup, so there's no external URL to keep in sync — edit the `<svg>` coordinates/colors directly in each template if the app logo ever changes, matching `public/logo.svg`
2. **Colors**:
   - Primary background: `#0a1526`
   - Accent color: `#C8F135`
   - Gradients: Adjust the gradient colors in the CSS
3. **Text Content**: Modify the French text to match your brand voice
4. **Footer**: Update copyright year and company name

## Template Structure

Each template follows this structure:

```
┌─────────────────────────────┐
│ Header with Logo & Title    │ ← Gradient background with logo
├─────────────────────────────┤
│ Main Content                 │ ← Welcome text and description
│ ┌─────────────────────────┐ │
│ │   CTA Button            │ │ ← Primary action
│ └─────────────────────────┘ │
│ Info/Warning Boxes          │ ← Context-specific information
│ Fallback Link               │ ← Plain text URL
├─────────────────────────────┤
│ Footer                       │ ← Copyright and notices
└─────────────────────────────┘
```

## Testing

Before deploying, test the templates:

1. Use a tool like [Litmus](https://www.litmus.com/) or [Email on Acid](https://www.emailonacid.com/)
2. Test with actual Supabase auth flows in development
3. Check rendering in major email clients:
   - Gmail (web, mobile)
   - Outlook (web, desktop)
   - Apple Mail
   - Yahoo Mail

## Best Practices

- Keep email width at 600px max for compatibility
- Use inline CSS for better email client support
- Include alt text for images
- Provide plain-text fallback links
- Test links before deployment
- Keep file sizes small (< 100KB)

## Support

For issues or questions about these templates, refer to:
- [Supabase Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
- Project documentation

---
