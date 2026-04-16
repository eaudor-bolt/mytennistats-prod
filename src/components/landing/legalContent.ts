export type LegalSection = {
  title: string;
  content: string;
};

export function getLegalContent(
  language: 'fr' | 'en'
): Record<string, LegalSection> {
  if (language === 'fr') {
    return {
      termsOfUse: {
        title: 'Conditions Générales d\'Utilisation',
        content: `Dernière mise à jour : Mars 2026

1. ACCEPTATION DES CONDITIONS

En accédant à MyTenniStats et en l'utilisant, vous acceptez d'être lié par ces Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.

2. DESCRIPTION DU SERVICE

MyTenniStats est une plateforme de gestion et d'analyse de tennis qui permet aux joueurs de :
• Suivre leurs performances lors de matchs en temps réel
• Enregistrer et analyser leurs résultats de matchs
• S'inscrire à des tournois de tennis
• Gérer leurs convocations et calendrier sportif
• Accéder à une base de données de clubs de tennis
• Télécharger et analyser des vidéos de leurs matchs
• Consulter les règles du tennis via un assistant IA

3. CRÉATION DE COMPTE

Pour utiliser MyTenniStats, vous devez créer un compte en fournissant :
• Une adresse email valide
• Un mot de passe sécurisé
• Votre prénom et nom
• Votre année de naissance

Vous êtes responsable de maintenir la confidentialité de vos identifiants de compte et de toute activité effectuée sous votre compte.

4. UTILISATION ACCEPTABLE

Vous vous engagez à :
• Fournir des informations exactes et à jour
• Ne pas partager votre compte avec d'autres personnes
• Ne pas utiliser le service à des fins illégales ou non autorisées
• Ne pas tenter de perturber ou d'altérer le fonctionnement du service
• Respecter les droits de propriété intellectuelle de MyTenniStats et des autres utilisateurs
• Ne pas publier de contenu offensant, diffamatoire ou inapproprié

5. CONTENU UTILISATEUR

Vous conservez tous les droits sur le contenu que vous créez et téléchargez (résultats de matchs, vidéos, statistiques). En utilisant MyTenniStats, vous nous accordez une licence mondiale, non exclusive et gratuite pour stocker, traiter et afficher votre contenu dans le but de fournir et d'améliorer le service.

Vous êtes seul responsable du contenu que vous téléchargez et devez vous assurer que vous disposez de tous les droits nécessaires.

6. ABONNEMENTS ET PAIEMENTS

MyTenniStats propose :
• Une version gratuite avec accès limité aux fonctionnalités de base
• Un abonnement Premium (5€/mois) avec accès illimité à toutes les fonctionnalités

Les paiements sont traités de manière sécurisée via Stripe. Les abonnements se renouvellent automatiquement jusqu'à leur annulation.

7. ANNULATION ET REMBOURSEMENT

Vous pouvez annuler votre abonnement à tout moment depuis vos paramètres de compte. L'annulation prendra effet à la fin de votre période de facturation en cours.

Conformément à la réglementation européenne, vous disposez d'un droit de rétractation de 14 jours à compter de la souscription.

8. PROPRIÉTÉ INTELLECTUELLE

MyTenniStats, son logo, sa conception et tous les contenus originaux sont protégés par des droits d'auteur et d'autres lois sur la propriété intellectuelle. Vous ne pouvez pas copier, modifier, distribuer ou vendre une partie du service sans notre autorisation écrite préalable.

9. CONFIDENTIALITÉ

Votre vie privée est importante pour nous. Notre utilisation de vos données personnelles est régie par notre Politique de Confidentialité. En utilisant MyTenniStats, vous consentez à notre collecte et utilisation de vos informations personnelles conformément à cette politique.

10. LIMITATION DE RESPONSABILITÉ

MyTenniStats est fourni "en l'état" sans garanties d'aucune sorte. Nous ne garantissons pas que le service sera ininterrompu, sécurisé ou sans erreur.

Nous ne sommes pas responsables :
• Des erreurs dans les résultats de matchs ou statistiques que vous saisissez
• De la perte de données due à des problèmes techniques
• Des dommages indirects résultant de l'utilisation du service
• Des informations de tournois fournies par des sources tierces

11. MODIFICATIONS DU SERVICE

Nous nous réservons le droit de modifier, suspendre ou interrompre tout ou partie du service à tout moment, avec ou sans préavis. Nous pouvons également modifier ces Conditions Générales d'Utilisation. Les modifications substantielles vous seront notifiées par email.

12. RÉSILIATION

Nous nous réservons le droit de suspendre ou de résilier votre compte si vous violez ces conditions, sans préavis et sans remboursement.

Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. La suppression est définitive et entraîne la perte de toutes vos données.

13. DONNÉES DE TOURNOIS

Les informations sur les tournois proviennent de sources publiques et tierces. Nous nous efforçons de maintenir ces informations à jour, mais ne garantissons pas leur exactitude. Vérifiez toujours les détails auprès des organisateurs de tournois.

14. CONTENUS VIDÉO

Vous êtes responsable de vous assurer que vous avez le droit de filmer et de télécharger des vidéos. Le consentement de tous les participants visibles dans vos vidéos peut être requis selon votre juridiction.

15. LOI APPLICABLE

Ces conditions sont régies par le droit français. En cas de litige, les tribunaux français seront compétents.

16. CONTACT

Pour toute question concernant ces Conditions Générales d'Utilisation :
Email : contact@mytennistats.com`,
      },
      privacyPolicy: {
        title: 'Politique de Confidentialité',
        content: `Dernière mise à jour : Mars 2026

Chez MyTenniStats, nous prenons votre vie privée au sérieux. Cette Politique de Confidentialité explique comment nous collectons, utilisons, divulguons et protégeons vos informations personnelles.

1. INFORMATIONS QUE NOUS COLLECTONS

a) Informations que vous nous fournissez :
• Informations de compte : prénom, nom, adresse email, année de naissance
• Profils de joueurs : noms des joueurs que vous créez, leurs informations
• Résultats de matchs : scores, statistiques, adversaires
• Inscriptions aux tournois : tournois auxquels vous vous inscrivez
• Convocations : détails de vos matchs programmés
• Vidéos : vidéos de matchs que vous téléchargez
• Informations de paiement : traitées par Stripe (nous ne stockons pas vos coordonnées bancaires)

b) Informations collectées automatiquement :
• Données d'utilisation : fonctionnalités utilisées, pages visitées, temps passé
• Données de l'appareil : type d'appareil, système d'exploitation, navigateur
• Données de localisation : localisation approximative basée sur votre adresse IP
• Cookies et technologies similaires

2. COMMENT NOUS UTILISONS VOS INFORMATIONS

Nous utilisons vos informations pour :
• Fournir et maintenir notre service
• Créer et gérer votre compte
• Traiter vos inscriptions aux tournois et convocations
• Stocker et analyser vos résultats de matchs et vidéos
• Traiter les paiements et gérer les abonnements
• Vous envoyer des mises à jour importantes sur le service
• Améliorer notre service grâce à l'analyse et aux retours
• Détecter et prévenir la fraude et les abus
• Se conformer aux obligations légales

3. PARTAGE DE VOS INFORMATIONS

Nous ne vendons pas vos informations personnelles. Nous pouvons partager vos informations avec :

a) Prestataires de services :
• Vercel (hébergement et infrastructure)
• Supabase (base de données et authentification)
• Stripe (traitement des paiements)
• AWS S3 (stockage de vidéos)
• Google Analytics (analytique)

b) Avec votre consentement :
• Résultats de matchs partagés : lorsque vous partagez des résultats via un lien
• Informations publiques de tournois : informations visibles sur les tournois publics

c) Pour des raisons légales :
• Si requis par la loi ou en réponse à des demandes légales valides
• Pour protéger nos droits, notre propriété ou notre sécurité

4. STOCKAGE ET SÉCURITÉ DES DONNÉES

Vos données sont stockées sur des serveurs sécurisés fournis par Supabase et Vercel. Les vidéos sont stockées sur AWS S3.

Nous mettons en œuvre des mesures de sécurité appropriées :
• Chiffrement des données en transit (HTTPS)
• Authentification sécurisée avec hachage des mots de passe
• Contrôles d'accès et politiques de sécurité au niveau des lignes
• Sauvegardes régulières
• Surveillance de la sécurité

Cependant, aucune méthode de transmission sur Internet n'est 100% sécurisée.

5. CONSERVATION DES DONNÉES

Nous conservons vos informations personnelles aussi longtemps que votre compte est actif ou selon les besoins pour fournir nos services.

• Données de compte : conservées jusqu'à la suppression du compte, puis 30 jours supplémentaires
• Résultats de matchs : conservés jusqu'à suppression manuelle ou suppression du compte
• Vidéos : conservées jusqu'à suppression manuelle ou suppression du compte
• Données de paiement : conservées conformément aux exigences légales (10 ans)
• Logs et analytique : conservés 13 mois maximum

6. VOS DROITS

Selon le RGPD, vous avez le droit de :
• Accéder à vos données personnelles
• Rectifier des données inexactes
• Supprimer vos données ("droit à l'oubli")
• Exporter vos données (portabilité des données)
• Vous opposer au traitement
• Limiter le traitement
• Retirer votre consentement à tout moment

Pour exercer ces droits, contactez-nous à contact@mytennistats.com ou utilisez les paramètres de votre compte pour gérer vos données.

7. SUPPRESSION DE COMPTE

Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Cela supprimera définitivement :
• Vos informations de compte
• Tous vos profils de joueurs
• Tous vos résultats de matchs
• Toutes vos inscriptions aux tournois
• Toutes vos vidéos
• Toutes vos convocations

Cette action est irréversible. Certaines informations peuvent être conservées dans nos sauvegardes pendant une période limitée.

8. COOKIES

Nous utilisons des cookies et technologies similaires pour :
• Maintenir votre session connectée
• Se souvenir de vos préférences
• Analyser l'utilisation du service
• Améliorer les performances

Vous pouvez contrôler les cookies via les paramètres de votre navigateur, mais certaines fonctionnalités peuvent ne pas fonctionner correctement si vous les désactivez.

9. SERVICES TIERS

Notre service s'intègre à des services tiers qui ont leurs propres politiques de confidentialité :
• Stripe pour le traitement des paiements
• Google Analytics pour l'analytique
• Vercel et Supabase pour l'hébergement

Nous vous encourageons à consulter leurs politiques de confidentialité.

10. TRANSFERTS INTERNATIONAUX DE DONNÉES

Vos données peuvent être transférées et traitées dans des pays en dehors de l'Union Européenne. Nous veillons à ce que des garanties appropriées soient en place, telles que :
• Clauses contractuelles types
• Décisions d'adéquation
• Bouclier de protection des données UE-États-Unis (si applicable)

11. CONFIDENTIALITÉ DES ENFANTS

MyTenniStats n'est pas destiné aux enfants de moins de 13 ans. Nous ne collectons pas sciemment d'informations personnelles auprès d'enfants de moins de 13 ans. Si nous découvrons qu'un enfant de moins de 13 ans nous a fourni des informations personnelles, nous les supprimerons.

Les utilisateurs âgés de 13 à 18 ans doivent obtenir le consentement parental avant d'utiliser MyTenniStats.

12. MODIFICATIONS DE CETTE POLITIQUE

Nous pouvons mettre à jour cette Politique de Confidentialité périodiquement. Les modifications substantielles vous seront notifiées par email ou via un avis visible sur notre service. Votre utilisation continue du service après de telles modifications constitue votre acceptation de la nouvelle politique.

13. VOS CHOIX DE CONFIDENTIALITÉ

Vous pouvez :
• Rendre vos résultats de matchs privés (par défaut)
• Choisir de partager des résultats spécifiques via des liens
• Contrôler les emails que vous recevez
• Désactiver l'analytique (peut affecter les fonctionnalités)
• Supprimer votre compte à tout moment

14. RÉCLAMATIONS

Si vous avez des préoccupations concernant notre traitement de vos données personnelles, vous avez le droit de déposer une plainte auprès de votre autorité de protection des données locale. En France, il s'agit de la CNIL (www.cnil.fr).

15. CONTACT

Pour toute question concernant cette Politique de Confidentialité ou nos pratiques en matière de données :
Email : contact@mytennistats.com

Nous répondrons à votre demande dans les 30 jours.`,
      },
    };
  }

  return {
    termsOfUse: {
      title: 'Terms of Service',
      content: `Last Updated: March 2026

1. ACCEPTANCE OF TERMS

By accessing and using MyTenniStats, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.

2. SERVICE DESCRIPTION

MyTenniStats is a tennis management and analysis platform that enables players to:
• Track their match performance in real-time
• Record and analyze their match results
• Register for tennis tournaments
• Manage their match schedules and convocations
• Access a database of tennis clubs
• Upload and analyze videos of their matches
• Consult tennis rules via an AI assistant

3. ACCOUNT CREATION

To use MyTenniStats, you must create an account by providing:
• A valid email address
• A secure password
• Your first and last name
• Your year of birth

You are responsible for maintaining the confidentiality of your account credentials and all activity that occurs under your account.

4. ACCEPTABLE USE

You agree to:
• Provide accurate and up-to-date information
• Not share your account with others
• Not use the service for illegal or unauthorized purposes
• Not attempt to disrupt or compromise the service
• Respect the intellectual property rights of MyTenniStats and other users
• Not post offensive, defamatory, or inappropriate content

5. USER CONTENT

You retain all rights to content you create and upload (match results, videos, statistics). By using MyTenniStats, you grant us a worldwide, non-exclusive, royalty-free license to store, process, and display your content for the purpose of providing and improving the service.

You are solely responsible for the content you upload and must ensure you have all necessary rights.

6. SUBSCRIPTIONS AND PAYMENTS

MyTenniStats offers:
• A free version with limited access to basic features
• A Premium subscription (€5/month) with unlimited access to all features

Payments are processed securely through Stripe. Subscriptions automatically renew until cancelled.

7. CANCELLATION AND REFUNDS

You can cancel your subscription at any time from your account settings. Cancellation will take effect at the end of your current billing period.

In accordance with European regulations, you have a 14-day right of withdrawal from the subscription date.

8. INTELLECTUAL PROPERTY

MyTenniStats, its logo, design, and all original content are protected by copyright and other intellectual property laws. You may not copy, modify, distribute, or sell any part of the service without our prior written permission.

9. PRIVACY

Your privacy is important to us. Our use of your personal data is governed by our Privacy Policy. By using MyTenniStats, you consent to our collection and use of your personal information in accordance with that policy.

10. LIMITATION OF LIABILITY

MyTenniStats is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, or error-free.

We are not responsible for:
• Errors in match results or statistics that you enter
• Data loss due to technical issues
• Indirect damages resulting from use of the service
• Tournament information provided by third-party sources

11. SERVICE MODIFICATIONS

We reserve the right to modify, suspend, or discontinue all or part of the service at any time, with or without notice. We may also modify these Terms of Service. Substantial changes will be notified to you by email.

12. TERMINATION

We reserve the right to suspend or terminate your account if you violate these terms, without notice and without refund.

You can delete your account at any time from your settings. Deletion is permanent and results in the loss of all your data.

13. TOURNAMENT DATA

Tournament information comes from public and third-party sources. We strive to keep this information up-to-date but do not guarantee its accuracy. Always verify details with tournament organizers.

14. VIDEO CONTENT

You are responsible for ensuring you have the right to film and upload videos. Consent from all participants visible in your videos may be required depending on your jurisdiction.

15. APPLICABLE LAW

These terms are governed by French law. In the event of a dispute, French courts shall have jurisdiction.

16. CONTACT

For any questions regarding these Terms of Service:
Email: contact@mytennistats.com`,
    },
    privacyPolicy: {
      title: 'Privacy Policy',
      content: `Last Updated: March 2026

At MyTenniStats, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and protect your personal information.

1. INFORMATION WE COLLECT

a) Information you provide to us:
• Account information: first name, last name, email address, year of birth
• Player profiles: names of players you create, their information
• Match results: scores, statistics, opponents
• Tournament registrations: tournaments you register for
• Convocations: details of your scheduled matches
• Videos: match videos you upload
• Payment information: processed by Stripe (we don't store your banking details)

b) Information collected automatically:
• Usage data: features used, pages visited, time spent
• Device data: device type, operating system, browser
• Location data: approximate location based on your IP address
• Cookies and similar technologies

2. HOW WE USE YOUR INFORMATION

We use your information to:
• Provide and maintain our service
• Create and manage your account
• Process your tournament registrations and convocations
• Store and analyze your match results and videos
• Process payments and manage subscriptions
• Send you important updates about the service
• Improve our service through analysis and feedback
• Detect and prevent fraud and abuse
• Comply with legal obligations

3. SHARING YOUR INFORMATION

We do not sell your personal information. We may share your information with:

a) Service providers:
• Vercel (hosting and infrastructure)
• Supabase (database and authentication)
• Stripe (payment processing)
• AWS S3 (video storage)
• Google Analytics (analytics)

b) With your consent:
• Shared match results: when you share results via a link
• Public tournament information: information visible on public tournaments

c) For legal reasons:
• If required by law or in response to valid legal requests
• To protect our rights, property, or safety

4. DATA STORAGE AND SECURITY

Your data is stored on secure servers provided by Supabase and Vercel. Videos are stored on AWS S3.

We implement appropriate security measures:
• Data encryption in transit (HTTPS)
• Secure authentication with password hashing
• Access controls and row-level security policies
• Regular backups
• Security monitoring

However, no method of transmission over the Internet is 100% secure.

5. DATA RETENTION

We retain your personal information as long as your account is active or as needed to provide our services.

• Account data: retained until account deletion, then 30 additional days
• Match results: retained until manual deletion or account deletion
• Videos: retained until manual deletion or account deletion
• Payment data: retained according to legal requirements (10 years)
• Logs and analytics: retained for a maximum of 13 months

6. YOUR RIGHTS

Under GDPR, you have the right to:
• Access your personal data
• Rectify inaccurate data
• Delete your data ("right to be forgotten")
• Export your data (data portability)
• Object to processing
• Restrict processing
• Withdraw your consent at any time

To exercise these rights, contact us at contact@mytennistats.com or use your account settings to manage your data.

7. ACCOUNT DELETION

You can delete your account at any time from your settings. This will permanently delete:
• Your account information
• All your player profiles
• All your match results
• All your tournament registrations
• All your videos
• All your convocations

This action is irreversible. Some information may be retained in our backups for a limited period.

8. COOKIES

We use cookies and similar technologies to:
• Maintain your logged-in session
• Remember your preferences
• Analyze service usage
• Improve performance

You can control cookies through your browser settings, but some features may not work properly if you disable them.

9. THIRD-PARTY SERVICES

Our service integrates with third-party services that have their own privacy policies:
• Stripe for payment processing
• Google Analytics for analytics
• Vercel and Supabase for hosting

We encourage you to review their privacy policies.

10. INTERNATIONAL DATA TRANSFERS

Your data may be transferred and processed in countries outside the European Union. We ensure that appropriate safeguards are in place, such as:
• Standard contractual clauses
• Adequacy decisions
• EU-US Data Privacy Framework (if applicable)

11. CHILDREN'S PRIVACY

MyTenniStats is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided us with personal information, we will delete it.

Users aged 13-18 must obtain parental consent before using MyTenniStats.

12. CHANGES TO THIS POLICY

We may update this Privacy Policy periodically. Substantial changes will be notified to you by email or through a prominent notice on our service. Your continued use of the service after such changes constitutes your acceptance of the new policy.

13. YOUR PRIVACY CHOICES

You can:
• Make your match results private (default)
• Choose to share specific results via links
• Control which emails you receive
• Disable analytics (may affect features)
• Delete your account at any time

14. COMPLAINTS

If you have concerns about our processing of your personal data, you have the right to lodge a complaint with your local data protection authority. In France, this is the CNIL (www.cnil.fr).

15. CONTACT

For any questions regarding this Privacy Policy or our data practices:
Email: contact@mytennistats.com

We will respond to your request within 30 days.`,
    },
  };
}
