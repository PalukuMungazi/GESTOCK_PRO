<?php
/**
 * Fonctions communes pour les réponses JSON de l'API.
 */

declare(strict_types=1);

function jsonResponse(bool $success, string $message, array $data = [], int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');

    // Module 15 : journaliser automatiquement les opérations POST réussies.
    if ($success && function_exists('auditResponse')) {
        try { auditResponse(); } catch (Throwable $e) { /* Le journal ne doit jamais bloquer l'opération principale. */ }
    }

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

/**
 * Lit le corps JSON envoyé par JavaScript.
 */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);

    return is_array($data) ? $data : [];
}
