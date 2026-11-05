<?php
/**
 * GESTOCK PRO - Sécurité commune des sessions et de l'API.
 *
 * Ce fichier centralise les protections utilisées par les différents scripts PHP.
 */
declare(strict_types=1);

// Cookies de session protégés contre JavaScript et les requêtes cross-site.
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// En-têtes HTTP de sécurité de base.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');

function requireLogin(): int
{
    $id = (int)($_SESSION['user_id'] ?? 0);
    if ($id <= 0) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success'=>false,'message'=>'Session expirée. Veuillez vous reconnecter.','data'=>[]], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $id;
}

function destroyUserSession(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
    }
    session_destroy();
}
