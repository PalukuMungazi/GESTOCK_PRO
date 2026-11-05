<?php
/**
 * GESTOCK PRO - Connexion à MySQL avec PDO
 *
 * Ce fichier centralise les paramètres de connexion à la base de données.
 * Toutes les autres parties du back-end utiliseront cette connexion.
 */

declare(strict_types=1);

// Paramètres MySQL de WampServer.
// Si ton installation utilise un mot de passe pour root, modifie DB_PASS.
define('DB_HOST', 'localhost');
define('DB_NAME', 'gestock_pro');
define('DB_USER', 'root');
define('DB_PASS', '');

define('DB_CHARSET', 'utf8mb4');

/**
 * Retourne une connexion PDO vers la base GESTOCK PRO.
 */
function db(): PDO
{
    static $pdo = null;

    // On réutilise la même connexion pendant la requête PHP.
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        return $pdo;
    } catch (PDOException $e) {
        // Ne jamais exposer les détails internes de MySQL au navigateur.
        error_log('[GESTOCK PRO DB] ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Impossible de se connecter à la base de données.',
                    ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
