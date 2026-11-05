<?php
/**
 * GESTOCK PRO - Sauvegarde complète MySQL
 *
 * Génère un vrai fichier SQL contenant la structure et les données de la base.
 * Seul l'administrateur peut télécharger cette sauvegarde.
 */
declare(strict_types=1);
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';

try {
    $pdo = db();

    // Le login de GESTOCK PRO enregistre le rôle directement dans la session
    // avec la clé $_SESSION['role_name']. L'ancien code cherchait $_SESSION['user'],
    // qui n'existe pas dans notre système d'authentification.
    $role = (string)($_SESSION['role_name'] ?? '');

    // Vérification supplémentaire en base : on récupère le rôle réel de l'utilisateur.
    // Cela évite de dépendre uniquement d'une valeur conservée dans la session.
    $userId = requireLogin();
    if ($userId > 0) {
        $stmtRole = $pdo->prepare("SELECT r.name AS role_name
                                  FROM users u
                                  INNER JOIN roles r ON r.id = u.role_id
                                  WHERE u.id = :id
                                  LIMIT 1");
        $stmtRole->execute(['id' => $userId]);
        $dbRole = $stmtRole->fetchColumn();
        if ($dbRole !== false) {
            $role = (string)$dbRole;
        }
    }

    if ($role !== 'Administrateur') {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        exit("Accès refusé. Seul l'administrateur peut effectuer une sauvegarde.\n");
    }

    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $sql = "-- GESTOCK PRO - Sauvegarde MySQL\n-- Date : " . date('Y-m-d H:i:s') . "\n-- Base : gestock_pro\n\nSET FOREIGN_KEY_CHECKS=0;\n\n";

    foreach ($tables as $table) {
        $safeTable = str_replace('`', '``', (string)$table);
        $create = $pdo->query("SHOW CREATE TABLE `{$safeTable}`")->fetch(PDO::FETCH_ASSOC);
        $createSql = $create['Create Table'] ?? '';
        $sql .= "DROP TABLE IF EXISTS `{$safeTable}`;\n" . $createSql . ";\n\n";

        $rows = $pdo->query("SELECT * FROM `{$safeTable}`")->fetchAll(PDO::FETCH_ASSOC);
        if ($rows) {
            $columns = array_keys($rows[0]);
            $columnSql = implode(',', array_map(fn($c) => '`' . str_replace('`', '``', $c) . '`', $columns));
            foreach ($rows as $row) {
                $values = [];
                foreach ($columns as $column) {
                    $value = $row[$column];
                    $values[] = $value === null ? 'NULL' : $pdo->quote((string)$value);
                }
                $sql .= "INSERT INTO `{$safeTable}` ({$columnSql}) VALUES (" . implode(',', $values) . ");\n";
            }
            $sql .= "\n";
        }
    }

    $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
    $filename = 'gestock_pro_backup_' . date('Y-m-d_H-i-s') . '.sql';
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($sql));
    echo $sql;
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    error_log('[GESTOCK PRO BACKUP] ' . $e->getMessage());
    echo "Sauvegarde impossible. Veuillez réessayer.";
}
