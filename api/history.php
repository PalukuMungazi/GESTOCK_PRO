<?php
declare(strict_types=1);
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
$userId=requireLogin(); $pdo=db(); $type=strtolower(trim((string)($_GET['type']??''))); $id=(int)($_GET['id']??0);
if(!in_array($type,['customer','supplier'],true)||$id<=0) jsonResponse(false,'Historique invalide.',[],400);
try{
 $st=$pdo->prepare("SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.status='ACTIF'");$st->execute([$userId]);$role=(string)$st->fetchColumn();
 $allowed=$type==='customer'?in_array($role,['Administrateur','Gérant','Caissier'],true):in_array($role,['Administrateur','Gérant','Gestionnaire de stock'],true);
 if(!$allowed) jsonResponse(false,'Accès refusé : votre rôle ne permet pas de consulter cet historique.',[],403);
 $settings=$pdo->query('SELECT company_name company,phone,email,address,currency,tax_number FROM company_settings ORDER BY id LIMIT 1')->fetch(PDO::FETCH_ASSOC)?:[];
 if($type==='customer'){$st=$pdo->prepare('SELECT id,code,name,phone,email,address,status FROM customers WHERE id=? LIMIT 1');$st->execute([$id]);$entity=$st->fetch(PDO::FETCH_ASSOC);if(!$entity)jsonResponse(false,'Client introuvable.',[],404);$q=$pdo->prepare("SELECT DATE_FORMAT(s.sale_date,'%Y-%m-%d %H:%i') date,s.reference,s.total_amount total,s.paid_amount paid,s.remaining_amount remaining,s.status FROM sales s WHERE s.customer_id=? ORDER BY s.sale_date DESC,s.id DESC");$q->execute([$id]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);$label='Vente';}
 else{$st=$pdo->prepare('SELECT id,name,contact,phone,email,address,status FROM suppliers WHERE id=? LIMIT 1');$st->execute([$id]);$entity=$st->fetch(PDO::FETCH_ASSOC);if(!$entity)jsonResponse(false,'Fournisseur introuvable.',[],404);$q=$pdo->prepare("SELECT DATE_FORMAT(p.purchase_date,'%Y-%m-%d %H:%i') date,p.reference,p.total_amount total,p.paid_amount paid,p.remaining_amount remaining,p.status FROM purchases p WHERE p.supplier_id=? ORDER BY p.purchase_date DESC,p.id DESC");$q->execute([$id]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);$label='Achat';}
 foreach($rows as &$r){$r['type']=$label;$r['total']=(float)$r['total'];$r['paid']=(float)$r['paid'];$r['remaining']=(float)$r['remaining'];$r['status']=ucwords(strtolower(str_replace('_',' ',$r['status'])));}unset($r);
 $summary=['operations'=>count($rows),'total'=>0.0,'paid'=>0.0,'balance'=>0.0];foreach($rows as $r){$summary['total']+=(float)$r['total'];$summary['paid']+=(float)$r['paid'];$summary['balance']+=(float)$r['remaining'];}
 jsonResponse(true,'Historique récupéré.',compact('entity','rows','summary','settings'));
}catch(Throwable $e){error_log('[GESTOCK PRO HISTORY] '.$e->getMessage());jsonResponse(false,'Impossible de récupérer l’historique.',[],500);}
