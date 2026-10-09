# MetaLink — première maquette

Site vitrine responsive consacré au commerce de produits métalliques et à la construction métallique.

## Contenu
- `index.html` : structure de la page en français
- `style.css` : design responsive pour mobile et ordinateur
- `script.js` : menu mobile, filtre de démonstration et formulaire de démonstration

## Lancer localement
Ouvrir `index.html` dans un navigateur. Les images distantes et les polices nécessitent une connexion Internet.

## Important
Cette version est une maquette front-end. Elle ne comprend pas encore de base de données, de comptes utilisateurs, de gestion de fournisseurs, de messagerie, de devis réels ni de paiement. Les fiches produits sont des exemples de démonstration et ne représentent pas des offres commerciales réelles.


## MetaLink Logistique (V3)
Cette version ajoute deux formulaires de démonstration : publication d'un camion/retour disponible et demande de transport pour une marchandise métallique. Les annonces sont affichées localement dans la page uniquement. Aucun backend, compte, stockage durable, réservation ou messagerie réelle n'est connecté.


## Connexion Supabase
Le module Logistique utilise Supabase pour lire et publier les annonces. Le navigateur utilise uniquement une clé Publishable (jamais une clé Secret). La table `public.annonces` et ses politiques RLS doivent être créées dans Supabase.
