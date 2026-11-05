<?php
/**
 * GESTOCK PRO - Vérification de la session courante.
 * Permet au front-end de savoir si l'utilisateur est déjà connecté.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

if (empty($_SESSION['user_id'])) {
    jsonResponse(false, 'Utilisateur non connecté.', [], 401);
}

try {
    $stmt = db()->prepare("SELECT
        u.id, u.name, u.email, u.username, u.status,
        r.id AS role_id, r.name AS role_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE u.id = :id
        LIMIT 1");
    $stmt->execute(['id' => $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user || $user['status'] !== 'ACTIF') {
        destroyUserSession();
        jsonResponse(false, 'Session invalide.', [], 401);
    }

    jsonResponse(true, 'Session active.', ['user' => $user]);
} catch (Throwable $e) {
    jsonResponse(false, 'Impossible de vérifier la session.', [], 500);
}
