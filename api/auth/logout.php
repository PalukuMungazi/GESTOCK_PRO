<?php
/**
 * GESTOCK PRO - Déconnexion
 * Détruit la session PHP de l'utilisateur connecté.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/response.php';

destroyUserSession();

jsonResponse(true, 'Déconnexion réussie.');
