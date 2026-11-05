<?php
/**
 * Fichier de test temporaire de la connexion MySQL.
 * À supprimer ou désactiver après vérification.
 */

declare(strict_types=1);
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';

try {
    $count = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    jsonResponse(true, 'Connexion MySQL réussie.', ['users_count' => $count]);
} catch (Throwable $e) {
    jsonResponse(false, 'Test MySQL échoué.', [], 500);
}
