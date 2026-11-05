<?php
/**
 * GESTOCK PRO - Connexion utilisateur
 *
 * Reçoit :
 * {
 *   "username": "admin",
 *   "password": "admin"
 * }
 *
 * Vérifie l'utilisateur dans MySQL puis crée une session PHP.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers/auth.php';

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

// Pour ce premier module, nous acceptons uniquement POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Méthode non autorisée.', [], 405);
}

$body = getJsonBody();
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

// Vérification simple des champs obligatoires.
if ($username === '' || $password === '') {
    jsonResponse(false, 'Veuillez saisir votre identifiant et votre mot de passe.', [], 422);
}

try {
    $pdo = db();

    // Jointure avec roles pour récupérer le nom du rôle.
    // La requête préparée protège contre les injections SQL.
    $sql = "SELECT
                u.id,
                u.name,
                u.email,
                u.username,
                u.password,
                u.status,
                r.id AS role_id,
                r.name AS role_name
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.username = :username
            LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    // On ne précise pas si l'identifiant ou le mot de passe est faux.
    if (!$user || !password_verify($password, $user['password'])) {
        jsonResponse(false, 'Identifiant ou mot de passe incorrect.', [], 401);
    }

    if ($user['status'] !== 'ACTIF') {
        jsonResponse(false, 'Ce compte est désactivé.', [], 403);
    }

    // Régénérer l'ID de session après une authentification réussie.
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['role_id'] = (int)$user['role_id'];
    $_SESSION['role_name'] = $user['role_name'];
    $_SESSION['username'] = $user['username'];

    // Enregistrer la date/heure de la dernière connexion.
    $update = $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = :id');
    $update->execute(['id' => $user['id']]);

    // Ne jamais envoyer le mot de passe au navigateur.
    unset($user['password']);

    jsonResponse(true, 'Connexion réussie.', [
        'user' => $user,
    ]);
} catch (Throwable $e) {
    jsonResponse(false, 'Une erreur est survenue pendant la connexion.', [], 500);
}
