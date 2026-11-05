<?php
/**
 * GESTOCK PRO - Documents imprimables
 *
 * Génère les données complètes d'une vente ou d'un achat pour l'impression.
 * Aucun fichier SQL supplémentaire n'est nécessaire.
 */
declare(strict_types=1);
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/config/database.php';

$userId = requireLogin();
$pdo = db();
$type = strtolower(trim((string)($_GET['type'] ?? '')));
$id = (int)($_GET['id'] ?? 0);

if (!in_array($type, ['sale', 'purchase'], true) || $id <= 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>false,'message'=>'Document invalide.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $settings = $pdo->query('SELECT company_name,phone,email,address,currency,tax_number FROM company_settings ORDER BY id LIMIT 1')->fetch(PDO::FETCH_ASSOC) ?: [];

    if ($type === 'sale') {
        $st = $pdo->prepare("SELECT s.id,s.reference,s.sale_date,s.subtotal,s.discount,s.tva_amount,s.total_amount,s.paid_amount,s.remaining_amount,s.payment_method,s.status,s.notes,
            COALESCE(c.name,'Comptant') customer_name,c.phone customer_phone,c.email customer_email,c.address customer_address,
            u.name cashier
            FROM sales s
            LEFT JOIN customers c ON c.id=s.customer_id
            JOIN users u ON u.id=s.user_id
            WHERE s.id=? LIMIT 1");
        $st->execute([$id]);
        $doc = $st->fetch(PDO::FETCH_ASSOC);
        if (!$doc) throw new RuntimeException('Vente introuvable.');

        $it = $pdo->prepare("SELECT p.code,p.name,p.unit,si.quantity,si.unit_price,si.discount,si.tva,si.total_price
            FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=? ORDER BY si.id");
        $it->execute([$id]);
        $items = $it->fetchAll(PDO::FETCH_ASSOC);
        $doc['items'] = $items;
        $doc['document_type'] = ((float)$doc['remaining_amount'] > 0) ? 'FACTURE' : 'REÇU DE VENTE';
    } else {
        $st = $pdo->prepare("SELECT p.id,p.reference,p.purchase_date,p.total_amount,p.paid_amount,p.remaining_amount,p.status,p.notes,
            s.name supplier_name,s.contact supplier_contact,s.phone supplier_phone,s.email supplier_email,s.address supplier_address,
            u.name buyer
            FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN users u ON u.id=p.user_id
            WHERE p.id=? LIMIT 1");
        $st->execute([$id]);
        $doc = $st->fetch(PDO::FETCH_ASSOC);
        if (!$doc) throw new RuntimeException('Achat introuvable.');

        $it = $pdo->prepare("SELECT pr.code,pr.name,pr.unit,pi.quantity,pi.unit_price,pi.total_price
            FROM purchase_items pi JOIN products pr ON pr.id=pi.product_id WHERE pi.purchase_id=? ORDER BY pi.id");
        $it->execute([$id]);
        $items = $it->fetchAll(PDO::FETCH_ASSOC);
        $doc['items'] = $items;
        $doc['document_type'] = 'BON D’ACHAT';
    }

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>true,'message'=>'Document récupéré.','data'=>['settings'=>$settings,'document'=>$doc]], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[GESTOCK PRO DOCUMENT] '.$e->getMessage());
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>false,'message'=>'Impossible de récupérer le document.'], JSON_UNESCAPED_UNICODE);
}
