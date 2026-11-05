GESTOCK PRO — Module 16 : Sauvegarde

Ce module ajoute une sauvegarde complète de la base MySQL.

Fonctionnalités :
- Page Sauvegarde accessible à l'Administrateur.
- Téléchargement d'un vrai fichier .sql contenant la structure et les données.
- Les sauvegardes peuvent être conservées sur un autre support.

Installation :
1. Remplacer le contenu de C:\wamp64\www\GESTOCK_PRO\
2. Ne pas réimporter le SQL de ce ZIP.
3. Ouvrir http://localhost/GESTOCK_PRO/
4. Faire Ctrl+F5.
5. Ouvrir Sauvegarde et cliquer sur Télécharger la sauvegarde SQL.

## MODULE 17 — Sécurité et protection de l'API

Cette version renforce la sécurité sans modifier les fonctionnalités métier :
- sessions PHP avec cookie HttpOnly et SameSite=Lax ;
- régénération de l'identifiant de session après connexion ;
- vérification de connexion côté serveur pour les API ;
- protection du générateur PDF ;
- protection de la sauvegarde SQL ;
- en-têtes HTTP de sécurité de base ;
- messages d'erreur techniques non exposés à l'utilisateur ;
- journalisation serveur des erreurs techniques.

### Installation
Remplacer les fichiers du projet par cette version. Ne pas réimporter la base SQL.
Puis faire Ctrl+F5 et tester connexion, modules, PDF et sauvegarde.

## MODULE 19 - Historique clients et fournisseurs
- Historique détaillé des ventes d'un client.
- Historique détaillé des achats d'un fournisseur.
- Totaux : opérations, total, payé, solde.
- Impression d'un relevé client ou fournisseur.
- Accès contrôlé selon le rôle.
- Le bouton d'impression du bon d'achat est affiché directement dans la liste Achats.

## MODULE 19 - Historique clients et fournisseurs
- Historique détaillé des ventes d'un client.
- Historique détaillé des achats d'un fournisseur.
- Totaux : opérations, total, payé, solde.
- Impression d'un relevé client ou fournisseur.
- Accès contrôlé selon le rôle.
- Le bouton d'impression du bon d'achat est affiché directement dans la liste Achats.


## MODULE 20 — ANALYSE ET STATISTIQUES
Ajout d'une page Analyse accessible selon les rôles autorisés. Les statistiques sont calculées côté serveur depuis MySQL : chiffre d'affaires, ventes, panier moyen, marge estimée, achats, créances, unités vendues, valeur du stock, évolution quotidienne, produits les plus vendus, meilleurs clients et modes de paiement. Les périodes 7, 30, 90 jours et 1 an sont disponibles.


## Module 21 — Finalisation et responsive
- Menu mobile avec bouton hamburger ☰.
- Menu principal masqué sur téléphone et affiché à la demande.
- Fermeture du menu après navigation ou clic sur l'arrière-plan.
- Adaptation des tableaux, formulaires, modales, KPI, POS et boutons aux petits écrans.
- Version 21 : dernière étape de la feuille de route initiale.

### Test mobile
Ouvrir GESTOCK PRO sur un smartphone ou utiliser le mode appareil mobile du navigateur. Après connexion, le menu latéral est caché. Cliquer sur ☰ pour l'ouvrir. Cliquer sur un module ou à l'extérieur pour le refermer.
