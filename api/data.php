<?php
/**
 * GESTOCK PRO - API principale des données
 *
 * Ce fichier remplace le localStorage du front-end.
 * Toutes les opérations importantes passent désormais par PHP + MySQL.
 */
declare(strict_types=1);
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';

$userId = requireLogin();

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$entity = $_GET['entity'] ?? '';
$action = $_GET['action'] ?? '';
$body = $method === 'POST' ? getJsonBody() : [];
// $userId est fourni et validé par requireLogin().

// -----------------------------------------------------------------------------
// MODULE 15 : JOURNAL D'ACTIVITE
// Le journal est créé automatiquement. Aucune réimportation SQL n'est nécessaire.
// -----------------------------------------------------------------------------
$pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    action_name VARCHAR(80) NOT NULL,
    entity_name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_date (created_at),
    INDEX idx_audit_user (user_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Cette fonction est appelée par response.php après une opération POST réussie.
function auditResponse(): void {
    global $pdo, $userId, $entity, $action, $body;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;
    $labels = [
        'save'=>'Enregistrement / modification', 'delete'=>'Suppression', 'sale'=>'Vente',
        'purchase'=>'Achat', 'cash'=>'Mouvement de caisse', 'updateCash'=>'Modification caisse',
        'deleteCash'=>'Suppression caisse', 'closeCash'=>'Clôture caisse', 'stock'=>'Mouvement de stock',
        'updatePurchase'=>'Modification achat'
    ];
    $label = $labels[$action] ?? ($action ?: 'Opération');
    $desc = $label . ' — ' . ($entity ?: 'système');
    if (isset($body['reference']) && $body['reference'] !== '') $desc .= ' (' . (string)$body['reference'] . ')';
    $st = $pdo->prepare('INSERT INTO audit_logs(user_id,action_name,entity_name,description) VALUES(?,?,?,?)');
    $st->execute([$userId ?: null, $action ?: 'operation', $entity ?: 'system', mb_substr($desc,0,255)]);
}

// -----------------------------------------------------------------------------
// MODULE 14 : AUTORISATIONS PAR RÔLE
// La navigation du front-end est filtrée, mais la sécurité est aussi contrôlée
// côté serveur afin qu'un utilisateur ne puisse pas contourner les permissions.
// -----------------------------------------------------------------------------
$roleStmt = $pdo->prepare("SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.status='ACTIF'");
$roleStmt->execute([$userId]);
$currentRole = (string)$roleStmt->fetchColumn();
$permissions = [
    'Administrateur'=>['*'],
    'Gérant'=>['dashboard','notifications','audit','products','categories','suppliers','customers','purchases','sales','pos','cash','stock','reports','settings'],
    'Caissier'=>['dashboard','notifications','customers','sales','pos','cash','reports'],
    'Gestionnaire de stock'=>['dashboard','notifications','products','categories','suppliers','purchases','stock','reports']
];
function allowedRole(string $role, string $resource): bool {
    global $permissions;
    $p=$permissions[$role]??[];
    return in_array('*',$p,true)||in_array($resource,$p,true);
}
function denyRole(string $resource): void { jsonResponse(false,'Accès refusé : votre rôle ne permet pas d’utiliser ce module.',[],403); }
function resourceFor(string $entity, string $action): string {
    if($entity==='dashboardStats') return 'dashboard';
    if($entity==='cashTransactions' || in_array($action,['cash','updateCash','deleteCash','closeCash'],true)) return 'cash';
    if($entity==='stockMovements' || $action==='stock') return 'stock';
    if($entity==='purchases' || in_array($action,['purchase','updatePurchase'],true)) return 'purchases';
    if($entity==='sales' || $action==='sale') return 'sales';
    if($entity==='users') return 'users';
    if($entity==='settings') return 'settings';
    if($entity==='auditLogs') return 'audit';
    if($entity==='analytics') return 'reports';
    return $entity;
}
$resource = resourceFor($entity,$action);
if(!allowedRole($currentRole,$resource)) denyRole($resource);

function failMsg(Throwable $e): void {
    error_log('[GESTOCK PRO] ' . $e->getMessage());
    jsonResponse(false, 'Opération impossible. Vérifiez les données saisies puis réessayez.', [], 400);
}
function idOf(PDO $pdo, string $table, string $column, $value): ?int {
    if ($value === null || $value === '') return null;
    $st = $pdo->prepare("SELECT id FROM {$table} WHERE {$column} = :v LIMIT 1");
    $st->execute(['v'=>$value]);
    $v = $st->fetchColumn();
    return $v === false ? null : (int)$v;
}
function nextRef(PDO $pdo, string $prefix, string $table, string $column): string {
    $year = date('Y');
    $like = $prefix . '-' . $year . '-%';
    $st = $pdo->prepare("SELECT {$column} FROM {$table} WHERE {$column} LIKE :l ORDER BY id DESC LIMIT 1");
    $st->execute(['l'=>$like]); $last = $st->fetchColumn();
    $n = $last ? ((int)substr((string)$last, -3) + 1) : 1;
    return sprintf('%s-%s-%03d', $prefix, $year, $n);
}
function statusStock(float $stock, float $min): string { return $stock <= 0 ? 'Rupture' : ($stock <= $min ? 'Stock faible' : 'En stock'); }
function userName(PDO $pdo, int $id): string { $st=$pdo->prepare('SELECT name FROM users WHERE id=?');$st->execute([$id]);return (string)$st->fetchColumn(); }

try {
    // ---------- LECTURE ----------
    if ($method === 'GET') {
        switch ($entity) {
            case 'products':
                $q=$pdo->query("SELECT p.*, c.name category, s.name supplier FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC");
                $rows=$q->fetchAll(); foreach($rows as &$r){$r['purchasePrice']=(float)$r['purchase_price'];$r['salePrice']=(float)$r['sale_price'];$r['minStock']=(float)$r['min_stock'];$r['stock']=(float)$r['stock'];$r['tva']=(float)$r['tva'];$r['dbStatus']=$r['status']==='ACTIF'?'Actif':'Inactif';$r['status']=statusStock((float)$r['stock'],(float)$r['min_stock']);} unset($r); break;
            case 'categories':
                $rows=$pdo->query("SELECT c.*, COUNT(p.id) products FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.id DESC")->fetchAll(); foreach($rows as &$r)$r['status']=$r['status']==='ACTIF'?'Actif':'Inactif'; unset($r); break;
            case 'suppliers':
                $rows=$pdo->query("SELECT s.*, COUNT(p.id) purchases, COALESCE(SUM(p.total_amount),0) total, COALESCE(SUM(p.remaining_amount),0) balance FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.status<>'ANNULE' GROUP BY s.id ORDER BY s.id DESC")->fetchAll(); foreach($rows as &$r){$r['status']=$r['status']==='ACTIF'?'Actif':'Inactif';$r['purchases']=(int)$r['purchases'];$r['total']=(float)$r['total'];$r['balance']=(float)$r['balance'];} unset($r); break;
            case 'customers':
                $rows=$pdo->query("SELECT c.*, COALESCE(SUM(CASE WHEN s.status<>'ANNULE' THEN s.total_amount ELSE 0 END),0) totalPurchases, COALESCE(SUM(CASE WHEN s.status<>'ANNULE' THEN s.paid_amount ELSE 0 END),0) paid, COALESCE(SUM(CASE WHEN s.status<>'ANNULE' THEN s.remaining_amount ELSE 0 END),0) balance FROM customers c LEFT JOIN sales s ON s.customer_id=c.id GROUP BY c.id ORDER BY c.id DESC")->fetchAll(); foreach($rows as &$r){$r['status']=$r['status']==='ACTIF'?'Actif':'Inactif';$r['totalPurchases']=(float)$r['totalPurchases'];$r['paid']=(float)$r['paid'];$r['balance']=(float)$r['balance'];} unset($r); break;
            case 'purchases':
                $rows=$pdo->query("SELECT p.id,p.reference ref,DATE(p.purchase_date) date,s.name supplier,p.total_amount total,p.paid_amount paid,p.remaining_amount remaining,p.status,u.name user,COUNT(pi.id) items FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN users u ON u.id=p.user_id LEFT JOIN purchase_items pi ON pi.purchase_id=p.id GROUP BY p.id ORDER BY p.id DESC")->fetchAll(); foreach($rows as &$r){$r['total']=(float)$r['total'];$r['paid']=(float)$r['paid'];$r['remaining']=(float)$r['remaining'];$r['status']=str_replace('_',' ',$r['status']);$r['status']=ucwords(strtolower($r['status']));} unset($r); break;
            case 'sales':
                $rows=$pdo->query("SELECT s.id,s.reference ref,DATE_FORMAT(s.sale_date,'%Y-%m-%d %H:%i') date,COALESCE(c.name,'Comptant') customer,s.total_amount total,s.paid_amount paid,s.remaining_amount remaining,s.payment_method method,s.status,u.name cashier,COUNT(si.id) items FROM sales s LEFT JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.user_id LEFT JOIN sale_items si ON si.sale_id=s.id GROUP BY s.id ORDER BY s.id DESC")->fetchAll(); foreach($rows as &$r){$r['total']=(float)$r['total'];$r['paid']=(float)$r['paid'];$r['remaining']=(float)$r['remaining'];$r['method']=str_replace('_',' ',$r['method']);$r['status']=ucwords(strtolower(str_replace('_',' ',$r['status'])));} unset($r); break;
            case 'stockMovements':
                $rows=$pdo->query("SELECT sm.*,p.name product,u.name user,DATE_FORMAT(sm.movement_date,'%Y-%m-%d %H:%i') date FROM stock_movements sm JOIN products p ON p.id=sm.product_id JOIN users u ON u.id=sm.user_id ORDER BY sm.id DESC")->fetchAll(); foreach($rows as &$r){$r['qty']=(float)$r['quantity'];$r['prevStock']=(float)$r['previous_stock'];$r['newStock']=(float)$r['new_stock'];$r['type']=ucfirst(strtolower($r['type']));} unset($r); break;
            case 'cashTransactions':
                $rows=$pdo->query("SELECT ct.*,DATE_FORMAT(ct.transaction_date,'%Y-%m-%d %H:%i') date,u.name user FROM cash_transactions ct JOIN users u ON u.id=ct.user_id ORDER BY ct.id DESC")->fetchAll(); foreach($rows as &$r){$r['entree']=$r['direction']==='ENTREE'?(float)$r['amount']:0;$r['sortie']=$r['direction']==='SORTIE'?(float)$r['amount']:0;$r['solde']=(float)($r['balance_after']??0);$r['type']=ucfirst(strtolower($r['type']));} unset($r); break;
            case 'users':
                $rows=$pdo->query("SELECT u.id,u.name,u.email,u.username,r.name role,u.status,u.last_login lastLogin FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id DESC")->fetchAll(); foreach($rows as &$r){$r['status']=$r['status']==='ACTIF'?'Actif':'Inactif';$r['lastLogin']=$r['lastLogin']?:'Jamais';} unset($r); break;
            case 'settings':
                $rows=$pdo->query('SELECT * FROM company_settings ORDER BY id LIMIT 1')->fetch(); if($rows){$rows=['company'=>$rows['company_name'],'phone'=>$rows['phone'],'email'=>$rows['email'],'address'=>$rows['address'],'currency'=>$rows['currency'],'tax'=>$rows['tax_number']];} break;
            case 'auditLogs':
                $q=$pdo->query("SELECT a.id,a.action_name action,a.entity_name entity,a.description,DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') date,COALESCE(u.name,'Utilisateur supprimé') user FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 500");
                $rows=$q->fetchAll();
                break;
            case 'analytics':
                $days=max(1,min(365,$days=(int)($_GET['days']??30)));
                $from=date('Y-m-d',strtotime('-'.($days-1).' days'));
                $st=$pdo->prepare("SELECT COUNT(*) sales_count, COALESCE(SUM(total_amount),0) revenue, COALESCE(SUM(paid_amount),0) paid, COALESCE(SUM(remaining_amount),0) receivables, COALESCE(AVG(total_amount),0) average_sale FROM sales WHERE sale_date>=? AND status<>'ANNULE'");
                $st->execute([$from]); $sum=$st->fetch(PDO::FETCH_ASSOC) ?: [];
                $st=$pdo->prepare("SELECT COALESCE(SUM(p.total_amount),0) FROM purchases p WHERE p.purchase_date>=? AND p.status<>'ANNULE'"); $st->execute([$from]); $purchases=(float)$st->fetchColumn();
                $st=$pdo->prepare("SELECT COALESCE(SUM(si.quantity),0), COALESCE(SUM(si.total_price),0), COALESCE(SUM(si.total_price - (si.quantity * pr.purchase_price)),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products pr ON pr.id=si.product_id WHERE s.sale_date>=? AND s.status<>'ANNULE'"); $st->execute([$from]); $u=$st->fetch(PDO::FETCH_NUM) ?: [0,0,0];
                $stockValue=(float)$pdo->query("SELECT COALESCE(SUM(stock*purchase_price),0) FROM products")->fetchColumn();
                $st=$pdo->prepare("SELECT DATE(sale_date) day, COALESCE(SUM(total_amount),0) sales, COUNT(*) count FROM sales WHERE sale_date>=? AND status<>'ANNULE' GROUP BY DATE(sale_date) ORDER BY day ASC"); $st->execute([$from]); $dailyRaw=$st->fetchAll(PDO::FETCH_ASSOC); $daily=[]; $map=[]; foreach($dailyRaw as $r)$map[$r['day']]=$r; for($i=$days-1;$i>=0;$i--){$d=date('Y-m-d',strtotime('-'.$i.' days'));$daily[]=['label'=>date('d/m',strtotime($d)),'date'=>$d,'sales'=>(float)($map[$d]['sales']??0),'count'=>(int)($map[$d]['count']??0)];}
                $st=$pdo->prepare("SELECT pr.name product, COALESCE(SUM(si.quantity),0) quantity, COALESCE(SUM(si.total_price),0) revenue, COALESCE(SUM(si.total_price-(si.quantity*pr.purchase_price)),0) margin FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products pr ON pr.id=si.product_id WHERE s.sale_date>=? AND s.status<>'ANNULE' GROUP BY pr.id,pr.name ORDER BY quantity DESC, revenue DESC LIMIT 10"); $st->execute([$from]); $top=$st->fetchAll(PDO::FETCH_ASSOC); foreach($top as &$r){$r['quantity']=(float)$r['quantity'];$r['revenue']=(float)$r['revenue'];$r['margin']=(float)$r['margin'];} unset($r);
                $st=$pdo->prepare("SELECT COALESCE(c.name,'Comptant') customer, COUNT(*) salesCount, COALESCE(SUM(s.total_amount),0) amount, COALESCE(SUM(s.remaining_amount),0) balance FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.sale_date>=? AND s.status<>'ANNULE' GROUP BY c.id,c.name ORDER BY amount DESC LIMIT 10"); $st->execute([$from]); $topCustomers=$st->fetchAll(PDO::FETCH_ASSOC); foreach($topCustomers as &$r){$r['salesCount']=(int)$r['salesCount'];$r['amount']=(float)$r['amount'];$r['balance']=(float)$r['balance'];} unset($r);
                $st=$pdo->prepare("SELECT REPLACE(payment_method,'_',' ') method, COALESCE(SUM(total_amount),0) amount FROM sales WHERE sale_date>=? AND status<>'ANNULE' GROUP BY payment_method ORDER BY amount DESC"); $st->execute([$from]); $payments=$st->fetchAll(PDO::FETCH_ASSOC); foreach($payments as &$r)$r['amount']=(float)$r['amount']; unset($r);
                $rows=['days'=>$days,'from'=>$from,'summary'=>['salesCount'=>(int)($sum['sales_count']??0),'revenue'=>(float)($sum['revenue']??0),'paid'=>(float)($sum['paid']??0),'receivables'=>(float)($sum['receivables']??0),'averageSale'=>(float)($sum['average_sale']??0),'purchases'=>$purchases,'unitsSold'=>(float)$u[0],'estimatedMargin'=>(float)$u[2],'stockValue'=>$stockValue],'daily'=>$daily,'topProducts'=>$top,'topCustomers'=>$topCustomers,'paymentMethods'=>$payments];
                break;
            case 'dashboardStats':
                // Les indicateurs du tableau de bord sont calculés directement par MySQL.
                // Cela évite les décalages de date entre le navigateur et le serveur.
                $today=(string)$pdo->query("SELECT CURDATE()")->fetchColumn();
                $st=$pdo->prepare("SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM sales WHERE DATE(sale_date)=CURDATE() AND status<>'ANNULE'");
                $st->execute(); $r=$st->fetch(PDO::FETCH_NUM);
                $salesTodayCount=(int)($r[0]??0); $revenueToday=(float)($r[1]??0);
                $purchasesMonthTotal=(float)$pdo->query("SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE YEAR(purchase_date)=YEAR(CURDATE()) AND MONTH(purchase_date)=MONTH(CURDATE()) AND status<>'ANNULE'")->fetchColumn();
                $stockUnits=(float)$pdo->query("SELECT COALESCE(SUM(stock),0) FROM products")->fetchColumn();
                $receivables=(float)$pdo->query("SELECT COALESCE(SUM(remaining_amount),0) FROM sales WHERE status<>'ANNULE'")->fetchColumn();
                $cashBalance=(float)$pdo->query("SELECT COALESCE(SUM(CASE WHEN direction='ENTREE' THEN amount ELSE -amount END),0) FROM cash_transactions")->fetchColumn();
                $rows=['today'=>$today,'salesTodayCount'=>$salesTodayCount,'revenueToday'=>$revenueToday,'purchasesMonthTotal'=>$purchasesMonthTotal,'stockUnits'=>$stockUnits,'receivables'=>$receivables,'cashBalance'=>$cashBalance];
                break;
            default: jsonResponse(false,'Entité inconnue.',[],404);
        }
        jsonResponse(true,'Données récupérées.',$rows ?? []);
    }

    // ---------- ECRITURE GENERIQUE ----------
    if ($method === 'POST' && $action === 'save') {
        if ($entity === 'categories') {
            $id=(int)($body['id']??0); $name=trim((string)($body['name']??'')); $desc=$body['description']??null; $status=(($body['status']??'Actif')==='Inactif')?'INACTIF':'ACTIF';
            if($name==='') jsonResponse(false,'Le nom est obligatoire.',[],422);
            if($id){$st=$pdo->prepare('UPDATE categories SET name=?,description=?,status=? WHERE id=?');$st->execute([$name,$desc,$status,$id]);}
            else{$st=$pdo->prepare('INSERT INTO categories(name,description,status) VALUES(?,?,?)');$st->execute([$name,$desc,$status]);$id=(int)$pdo->lastInsertId();}
        } elseif ($entity === 'suppliers') {
            $id=(int)($body['id']??0); $status=(($body['status']??'Actif')==='Inactif')?'INACTIF':'ACTIF';
            if($id){$st=$pdo->prepare('UPDATE suppliers SET name=?,contact=?,phone=?,email=?,address=?,status=? WHERE id=?');$st->execute([$body['name']??'', $body['contact']??null,$body['phone']??null,$body['email']??null,$body['address']??null,$status,$id]);}
            else{$st=$pdo->prepare('INSERT INTO suppliers(name,contact,phone,email,address,status) VALUES(?,?,?,?,?,?)');$st->execute([$body['name']??'', $body['contact']??null,$body['phone']??null,$body['email']??null,$body['address']??null,$status]);$id=(int)$pdo->lastInsertId();}
        } elseif ($entity === 'customers') {
            $id=(int)($body['id']??0); $status=(($body['status']??'Actif')==='Inactif')?'INACTIF':'ACTIF';
            if($id){$st=$pdo->prepare('UPDATE customers SET name=?,phone=?,email=?,address=?,status=? WHERE id=?');$st->execute([$body['name']??'', $body['phone']??null,$body['email']??null,$body['address']??null,$status,$id]);}
            else{$code=$body['code']??null;if(!$code)$code='CLI-'.str_pad((string)(((int)$pdo->query('SELECT COALESCE(MAX(id),0)+1 FROM customers')->fetchColumn())),3,'0',STR_PAD_LEFT);$st=$pdo->prepare('INSERT INTO customers(code,name,phone,email,address,status) VALUES(?,?,?,?,?,?)');$st->execute([$code,$body['name']??'', $body['phone']??null,$body['email']??null,$body['address']??null,$status]);$id=(int)$pdo->lastInsertId();}
        } elseif ($entity === 'products') {
            $id=(int)($body['id']??0); $cat=idOf($pdo,'categories','name',$body['category']??null) ?? (int)($body['category_id']??0); $sup=idOf($pdo,'suppliers','name',$body['supplier']??null); $sup=$sup?:null; $status=(($body['dbStatus']??'Actif')==='Inactif')?'INACTIF':'ACTIF';
            if(!$cat) jsonResponse(false,'Veuillez choisir une catégorie valide.',[],422);
            $code=$body['code']??''; if($code==='')$code='PRD-'.str_pad((string)(((int)$pdo->query('SELECT COALESCE(MAX(id),0)+1 FROM products')->fetchColumn())),3,'0',STR_PAD_LEFT);
            $vals=[$cat,$sup,$code,$body['name']??'',$body['description']??null,(float)($body['purchasePrice']??0),(float)($body['salePrice']??0),(float)($body['stock']??0),(float)($body['minStock']??0),(float)($body['tva']??18),$body['unit']??'Pcs',$status];
            if($id){$st=$pdo->prepare('UPDATE products SET category_id=?,supplier_id=?,code=?,name=?,description=?,purchase_price=?,sale_price=?,stock=?,min_stock=?,tva=?,unit=?,status=? WHERE id=?');$st->execute([...$vals,$id]);}
            else{$st=$pdo->prepare('INSERT INTO products(category_id,supplier_id,code,name,description,purchase_price,sale_price,stock,min_stock,tva,unit,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');$st->execute($vals);$id=(int)$pdo->lastInsertId();}
        } elseif ($entity === 'users') {
            $id=(int)($body['id']??0); $role=idOf($pdo,'roles','name',$body['role']??null) ?? 1; $status=(($body['status']??'Actif')==='Inactif')?'INACTIF':'ACTIF';
            if($id){$sql='UPDATE users SET role_id=?,name=?,email=?,username=?,status=?';$params=[$role,$body['name']??'',$body['email']??null,$body['username']??'',$status];if(!empty($body['password'])){$sql.=',password=?';$params[]=password_hash($body['password'],PASSWORD_DEFAULT);} $sql.=' WHERE id=?';$params[]=$id;$st=$pdo->prepare($sql);$st->execute($params);}
            else{$st=$pdo->prepare('INSERT INTO users(role_id,name,email,username,password,status) VALUES(?,?,?,?,?,?)');$st->execute([$role,$body['name']??'',$body['email']??'',$body['username']??'',password_hash((string)($body['password']??'admin'),PASSWORD_DEFAULT),$status]);$id=(int)$pdo->lastInsertId();}
        } elseif ($entity === 'settings') {
            $id=$pdo->query('SELECT id FROM company_settings ORDER BY id LIMIT 1')->fetchColumn();
            if($id){$st=$pdo->prepare('UPDATE company_settings SET company_name=?,phone=?,email=?,address=?,currency=?,tax_number=? WHERE id=?');$st->execute([$body['company']??'GESTOCK PRO',$body['phone']??null,$body['email']??null,$body['address']??null,$body['currency']??'$',$body['tax']??null,$id]);}
            else{$st=$pdo->prepare('INSERT INTO company_settings(company_name,phone,email,address,currency,tax_number) VALUES(?,?,?,?,?,?)');$st->execute([$body['company']??'GESTOCK PRO',$body['phone']??null,$body['email']??null,$body['address']??null,$body['currency']??'$',$body['tax']??null]);$id=(int)$pdo->lastInsertId();}
        } else jsonResponse(false,'Entité non supportée pour cette sauvegarde.',[],400);
        jsonResponse(true,'Enregistrement sauvegardé.',['id'=>$id]);
    }

    // ---------- SUPPRESSION ----------
    if ($method === 'POST' && $action === 'delete') {
        $tables=['categories','suppliers','customers','products','users','purchases']; if(!in_array($entity,$tables,true))jsonResponse(false,'Suppression non autorisée.',[],400);
        if($entity==='purchases'){
            $id=(int)($body['id']??0); if(!$id)jsonResponse(false,'Identifiant de l’achat manquant.',[],422);
            $pdo->beginTransaction();
            $st=$pdo->prepare('SELECT paid_amount,status FROM purchases WHERE id=? FOR UPDATE'); $st->execute([$id]); $purchase=$st->fetch();
            if(!$purchase)throw new Exception('Achat introuvable.');
            if((float)$purchase['paid_amount']>0)throw new Exception('Cet achat possède déjà un paiement et ne peut pas être supprimé.');
            $items=$pdo->prepare('SELECT product_id,quantity FROM purchase_items WHERE purchase_id=?');$items->execute([$id]);
            foreach($items->fetchAll() as $it){
                $q=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$q->execute([(int)$it['product_id']]);$prev=(float)$q->fetchColumn();$new=$prev-(float)$it['quantity'];if($new<0)$new=0;
                $pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,(int)$it['product_id']]);
                $ref=nextRef($pdo,'MVM','stock_movements','reference');
                $pdo->prepare('INSERT INTO stock_movements(product_id,user_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?)')->execute([(int)$it['product_id'],$userId,$ref,'ANNULATION_ACHAT',-(float)$it['quantity'],$prev,$new,'Suppression achat #'.$id]);
            }
            $pdo->prepare('DELETE FROM purchase_items WHERE purchase_id=?')->execute([$id]);
            $pdo->prepare('DELETE FROM purchase_payments WHERE purchase_id=?')->execute([$id]);
            $pdo->prepare('DELETE FROM purchases WHERE id=?')->execute([$id]);
            $pdo->commit(); jsonResponse(true,'Achat supprimé et stock rétabli.');
        }
        // Le produit est autorisé à la suppression. Si une relation empêche la suppression,
        // on donne un message précis plutôt que « Suppression non autorisée ».
        if($entity==='products'){
            $chk=$pdo->prepare('SELECT COUNT(*) FROM purchase_items WHERE product_id=?');
            $chk->execute([(int)($body['id']??0)]); $usedPurchase=(int)$chk->fetchColumn();
            $chk=$pdo->prepare('SELECT COUNT(*) FROM sale_items WHERE product_id=?');
            $chk->execute([(int)($body['id']??0)]); $usedSale=(int)$chk->fetchColumn();
            if($usedPurchase>0 || $usedSale>0)
                jsonResponse(false,'Ce produit est déjà utilisé dans un achat ou une vente et ne peut pas être supprimé.',[],409);
        }
        $id=(int)($body['id']??0); if(!$id)jsonResponse(false,'Identifiant manquant.',[],422);
        $st=$pdo->prepare("DELETE FROM {$entity} WHERE id=?");$st->execute([$id]);jsonResponse(true,'Suppression effectuée.');
    }

    // ---------- MODIFICATION ACHAT ----------
    if ($method === 'POST' && $action === 'updatePurchase') {
        $id=(int)($body['id']??0); if(!$id)throw new Exception('Achat introuvable.');
        $pdo->beginTransaction();
        $st=$pdo->prepare('SELECT paid_amount FROM purchases WHERE id=? FOR UPDATE');$st->execute([$id]);$old=$st->fetch();
        if(!$old)throw new Exception('Achat introuvable.');
        if((float)$old['paid_amount']>0)throw new Exception('Cet achat possède déjà un paiement et ne peut pas être modifié.');
        $supplier=idOf($pdo,'suppliers','name',$body['supplier']??null);if(!$supplier)throw new Exception('Fournisseur introuvable.');
        $items=$body['itemsData']??[];if(count($items)!==1)throw new Exception('Cet écran permet actuellement de modifier un seul article par achat.');
        $oldItems=$pdo->prepare('SELECT product_id,quantity FROM purchase_items WHERE purchase_id=?');$oldItems->execute([$id]);
        foreach($oldItems->fetchAll() as $it){$q=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$q->execute([(int)$it['product_id']]);$prev=(float)$q->fetchColumn();$new=$prev-(float)$it['quantity'];if($new<0)$new=0;$pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,(int)$it['product_id']]);$ref=nextRef($pdo,'MVM','stock_movements','reference');$pdo->prepare('INSERT INTO stock_movements(product_id,user_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?)')->execute([(int)$it['product_id'],$userId,$ref,'ANNULATION_ACHAT',-(float)$it['quantity'],$prev,$new,'Modification achat #'.$id]);}
        $it=$items[0];$pid=(int)$it['productId'];$qty=(float)$it['qty'];$price=(float)$it['price'];if(!$pid||$qty<=0||$price<0)throw new Exception('Article, quantité ou prix invalide.');
        $reference=trim((string)($body['ref']??''));if($reference==='')$reference=nextRef($pdo,'ACH','purchases','reference');$date=trim((string)($body['date']??''));$date=$date?($date.' 00:00:00'):date('Y-m-d H:i:s');$total=$qty*$price;
        $pdo->prepare('UPDATE purchases SET supplier_id=?,reference=?,purchase_date=?,total_amount=?,remaining_amount=? WHERE id=?')->execute([$supplier,$reference,$date,$total,$total,$id]);
        $pdo->prepare('DELETE FROM purchase_items WHERE purchase_id=?')->execute([$id]);$pdo->prepare('INSERT INTO purchase_items(purchase_id,product_id,quantity,unit_price,total_price) VALUES(?,?,?,?,?)')->execute([$id,$pid,$qty,$price,$total]);
        $q=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$q->execute([$pid]);$prev=(float)$q->fetchColumn();$new=$prev+$qty;$pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,$pid]);$ref=nextRef($pdo,'MVM','stock_movements','reference');$pdo->prepare('INSERT INTO stock_movements(product_id,user_id,purchase_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$pid,$userId,$id,$ref,'ACHAT',$qty,$prev,$new,'Modification achat '.$reference]);
        $pdo->commit();jsonResponse(true,'Achat modifié dans MySQL.',['id'=>$id]);
    }

    // ---------- ACHAT ----------
    if ($method === 'POST' && $action === 'purchase') {
        $pdo->beginTransaction();
        $supplier=idOf($pdo,'suppliers','name',$body['supplier']??null); if(!$supplier)throw new Exception('Fournisseur introuvable.');
        $reference=trim((string)($body['ref']??'')) ?: nextRef($pdo,'ACH','purchases','reference');
        $items=$body['itemsData']??[]; if(!$items)throw new Exception('Ajoutez au moins un article.');
        $total=0; foreach($items as $it){$total += (float)$it['qty']*(float)$it['price'];}
        $paid=min($total,max(0,(float)($body['paid']??0))); $remaining=$total-$paid; $status=$remaining<=0?'PAYE':($paid>0?'PARTIELLEMENT_PAYE':'NON_PAYE');
        $st=$pdo->prepare('INSERT INTO purchases(supplier_id,user_id,reference,purchase_date,total_amount,paid_amount,remaining_amount,status) VALUES(?,?,?,?,?,?,?,?)');$st->execute([$supplier,$userId,$reference,date('Y-m-d H:i:s'),$total,$paid,$remaining,$status]);$purchaseId=(int)$pdo->lastInsertId();
        foreach($items as $it){$pid=(int)$it['productId'];$qty=(float)$it['qty'];$price=(float)$it['price'];$st=$pdo->prepare('INSERT INTO purchase_items(purchase_id,product_id,quantity,unit_price,total_price) VALUES(?,?,?,?,?)');$st->execute([$purchaseId,$pid,$qty,$price,$qty*$price]);$p=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$p->execute([$pid]);$prev=(float)$p->fetchColumn();$new=$prev+$qty;$pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,$pid]);$ref=nextRef($pdo,'MVM','stock_movements','reference');$pdo->prepare('INSERT INTO stock_movements(product_id,user_id,purchase_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$pid,$userId,$purchaseId,$ref,'ACHAT',$qty,$prev,$new,'Achat '.$reference]);}
        if($paid>0){$method=(string)($body['method']??'ESPECES'); $methodMap=['Espèces'=>'ESPECES','Mobile Money'=>'MOBILE_MONEY','Virement'=>'VIREMENT','Carte bancaire'=>'CARTE','Carte'=>'CARTE','Crédit'=>'CREDIT']; $method=$methodMap[$method]??$method;$st=$pdo->prepare('INSERT INTO purchase_payments(purchase_id,user_id,amount,payment_method) VALUES(?,?,?,?)');$st->execute([$purchaseId,$userId,$paid,$method]);$ref=nextRef($pdo,'CAI','cash_transactions','reference');$bal=(float)$pdo->query("SELECT COALESCE(SUM(CASE WHEN direction='ENTREE' THEN amount ELSE -amount END),0) FROM cash_transactions")->fetchColumn();$newBal=$bal-$paid;$pdo->prepare('INSERT INTO cash_transactions(user_id,purchase_id,reference,type,description,amount,direction,balance_after,payment_method) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$userId,$purchaseId,$ref,'ACHAT','Paiement achat '.$reference,$paid,'SORTIE',$newBal,$method]);}
        $pdo->commit();jsonResponse(true,'Achat enregistré dans MySQL.',['id'=>$purchaseId]);
    }

    // ---------- VENTE ----------
    if ($method === 'POST' && $action === 'sale') {
        $pdo->beginTransaction(); $items=$body['items']??[]; if(!$items)throw new Exception('Panier vide.');
        $customer=$body['customer']??'Comptant';$customerId=$customer==='Comptant'?null:idOf($pdo,'customers','name',$customer);$ref=trim((string)($body['ref']??'')) ?: nextRef($pdo,'VTE','sales','reference');$subtotal=0;$tva=0;
        foreach($items as $it){$qty=(float)$it['qty'];$price=(float)$it['price'];$subtotal += $qty*$price; $p=$pdo->prepare('SELECT stock,tva FROM products WHERE id=? FOR UPDATE');$p->execute([(int)$it['id']]);$row=$p->fetch();if(!$row)throw new Exception('Produit introuvable.');if((float)$row['stock']<$qty)throw new Exception('Stock insuffisant pour '.$it['name'].'.');$tva += $qty*$price*((float)$row['tva']/100);}
        $discount=(float)($body['discount']??0);$total=max(0,$subtotal-$discount+$tva);$paid=min($total,max(0,(float)($body['paid']??$total)));$remaining=$total-$paid;$status=$remaining<=0?'PAYE':($paid>0?'PARTIELLEMENT_PAYE':'NON_PAYE');$method=$body['method']??'ESPECES';
        $st=$pdo->prepare('INSERT INTO sales(customer_id,user_id,reference,sale_date,subtotal,discount,tva_amount,total_amount,paid_amount,remaining_amount,payment_method,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');$st->execute([$customerId,$userId,$ref,date('Y-m-d H:i:s'),$subtotal,$discount,$tva,$total,$paid,$remaining,$method,$status]);$saleId=(int)$pdo->lastInsertId();
        foreach($items as $it){$pid=(int)$it['id'];$qty=(float)$it['qty'];$price=(float)$it['price'];$pdo->prepare('INSERT INTO sale_items(sale_id,product_id,quantity,unit_price,discount,tva,total_price) VALUES(?,?,?,?,?,?,?)')->execute([$saleId,$pid,$qty,$price,0,18,$qty*$price]);$p=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$p->execute([$pid]);$prev=(float)$p->fetchColumn();$new=$prev-$qty;$pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,$pid]);$mref=nextRef($pdo,'MVM','stock_movements','reference');$pdo->prepare('INSERT INTO stock_movements(product_id,user_id,sale_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$pid,$userId,$saleId,$mref,'VENTE',-$qty,$prev,$new,'Vente '.$ref]);}
        if($paid>0){$pdo->prepare('INSERT INTO sale_payments(sale_id,user_id,amount,payment_method) VALUES(?,?,?,?)')->execute([$saleId,$userId,$paid,$method]);if(in_array($method,['ESPECES','MOBILE_MONEY','CARTE'],true)){$cref=nextRef($pdo,'CAI','cash_transactions','reference');$bal=(float)$pdo->query("SELECT COALESCE(SUM(CASE WHEN direction='ENTREE' THEN amount ELSE -amount END),0) FROM cash_transactions")->fetchColumn();$newBal=$bal+$paid;$pdo->prepare('INSERT INTO cash_transactions(user_id,sale_id,reference,type,description,amount,direction,balance_after,payment_method) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$userId,$saleId,$cref,'VENTE','Vente '.$ref,$paid,'ENTREE',$newBal,$method]);}}
        $pdo->commit();jsonResponse(true,'Vente enregistrée dans MySQL.',['id'=>$saleId,'reference'=>$ref,'total'=>$total]);
    }

    // ---------- CAISSE MANUELLE ----------
    if ($method === 'POST' && $action === 'cash') {
        $amount=(float)($body['amount']??0);if($amount<=0)throw new Exception('Montant invalide.');$direction=($body['direction']??'ENTREE')==='SORTIE'?'SORTIE':'ENTREE';$ref=nextRef($pdo,'CAI','cash_transactions','reference');$bal=(float)$pdo->query("SELECT COALESCE(SUM(CASE WHEN direction='ENTREE' THEN amount ELSE -amount END),0) FROM cash_transactions")->fetchColumn();if($direction==='SORTIE' && $amount>$bal) throw new Exception('Sortie impossible : le montant demandé est supérieur au solde actuel de la caisse ('.number_format($bal,2,'.',' ').').');$new=$direction==='ENTREE'?$bal+$amount:$bal-$amount;$pdo->prepare('INSERT INTO cash_transactions(user_id,reference,type,description,amount,direction,balance_after,payment_method) VALUES(?,?,?,?,?,?,?,?)')->execute([$userId,$ref,$direction==='ENTREE'?'ENTREE':'DEPENSE',$body['description']??'Opération de caisse',$amount,$direction,$new,$body['method']??'ESPECES']);jsonResponse(true,'Transaction de caisse enregistrée.');
    }

    // ---------- MODIFIER UN MOUVEMENT MANUEL DE CAISSE ----------
    if ($method === 'POST' && $action === 'updateCash') {
        $id=(int)($body['id']??0);
        $amount=(float)($body['amount']??0);
        $direction=($body['direction']??'ENTREE')==='SORTIE'?'SORTIE':'ENTREE';
        $description=trim((string)($body['description']??''));
        $methodPay=(string)($body['method']??'ESPECES');
        $allowed=['ESPECES','MOBILE_MONEY','VIREMENT','CARTE','AUTRE','Espèces','Mobile Money','Virement','Carte bancaire','Carte'];
        $map=['Espèces'=>'ESPECES','Mobile Money'=>'MOBILE_MONEY','Virement'=>'VIREMENT','Carte bancaire'=>'CARTE','Carte'=>'CARTE'];
        $methodPay=$map[$methodPay]??$methodPay;
        if(!$id||$amount<=0) throw new Exception('Données du mouvement invalides.');
        if(!in_array($methodPay,['ESPECES','MOBILE_MONEY','VIREMENT','CARTE','AUTRE'],true)) throw new Exception('Mode de paiement invalide.');
        $pdo->beginTransaction();
        $st=$pdo->prepare('SELECT id,sale_id,purchase_id,direction,description,payment_method FROM cash_transactions WHERE id=? FOR UPDATE');$st->execute([$id]);$row=$st->fetch();
        if(!$row) throw new Exception('Mouvement introuvable.');
        if($row['sale_id']!==null||$row['purchase_id']!==null) throw new Exception('Ce mouvement est lié à une vente ou un achat et ne peut pas être modifié ici.');
        // Si la description est laissée vide, on conserve celle qui existe déjà.
        if($description==='') $description=$row['description'] ?: 'Opération de caisse';
        // La direction enregistrée en base reste la référence si le formulaire ne la transmet pas correctement.
        if(empty($body['direction'])) $direction=$row['direction'];
        // Pour une sortie modifiée, on retire d'abord l'ancien mouvement du calcul du solde.
        // Cela permet de modifier le montant sans considérer l'ancienne sortie comme encore débitée.
        if($direction==='SORTIE'){
            $currentBalance=(float)$pdo->query("SELECT COALESCE(SUM(CASE WHEN direction='ENTREE' THEN amount ELSE -amount END),0) FROM cash_transactions WHERE id<>".(int)$id)->fetchColumn();
            if($amount>$currentBalance) throw new Exception('Modification impossible : la nouvelle sortie est supérieure au solde disponible de la caisse ('.number_format($currentBalance,2,'.',' ').').');
        }
        $type=$direction==='ENTREE'?'ENTREE':'DEPENSE';
        $st=$pdo->prepare('UPDATE cash_transactions SET type=?,description=?,amount=?,direction=?,payment_method=? WHERE id=?');$st->execute([$type,$description,$amount,$direction,$methodPay,$id]);
        $balance=0.0;
        $rows=$pdo->query('SELECT id,amount,direction FROM cash_transactions ORDER BY id ASC FOR UPDATE')->fetchAll();
        $up=$pdo->prepare('UPDATE cash_transactions SET balance_after=? WHERE id=?');
        foreach($rows as $r){$balance += $r['direction']==='ENTREE'?(float)$r['amount']:-((float)$r['amount']);$up->execute([$balance,$r['id']]);}
        $pdo->commit();
        jsonResponse(true,'Mouvement de caisse modifié.');
    }

    // ---------- SUPPRIMER UN MOUVEMENT MANUEL DE CAISSE ----------
    if ($method === 'POST' && $action === 'deleteCash') {
        $id=(int)($body['id']??0); if(!$id) throw new Exception('Identifiant invalide.');
        $pdo->beginTransaction();
        $st=$pdo->prepare('SELECT id,sale_id,purchase_id FROM cash_transactions WHERE id=? FOR UPDATE');$st->execute([$id]);$row=$st->fetch();
        if(!$row) throw new Exception('Mouvement introuvable.');
        if($row['sale_id']!==null||$row['purchase_id']!==null) throw new Exception('Ce mouvement est lié à une vente ou un achat et ne peut pas être supprimé ici.');
        $pdo->prepare('DELETE FROM cash_transactions WHERE id=?')->execute([$id]);
        $balance=0.0;
        $rows=$pdo->query('SELECT id,amount,direction FROM cash_transactions ORDER BY id ASC FOR UPDATE')->fetchAll();
        $up=$pdo->prepare('UPDATE cash_transactions SET balance_after=? WHERE id=?');
        foreach($rows as $r){$balance += $r['direction']==='ENTREE'?(float)$r['amount']:-((float)$r['amount']);$up->execute([$balance,$r['id']]);}
        $pdo->commit();
        jsonResponse(true,'Mouvement de caisse supprimé.');
    }

    // ---------- CLOTURE DE CAISSE ----------
    if ($method === 'POST' && $action === 'closeCash') {
        $theoretical=(float)($body['theoretical']??0);
        $counted=(float)($body['counted']??0);
        $difference=$counted-$theoretical;
        $st=$pdo->prepare("INSERT INTO cash_sessions(user_id,opening_balance,theoretical_balance,counted_balance,difference,status,closing_date,notes) VALUES(?,?,?,?,?,'FERMEE',NOW(),?)");
        $st->execute([$userId,0,$theoretical,$counted,$difference,$body['notes']??null]);
        jsonResponse(true,'Clôture de caisse enregistrée.', ['difference'=>$difference]);
    }

    // ---------- ENTREE/AJUSTEMENT STOCK ----------
    if ($method === 'POST' && $action === 'stock') {
        $pid=(int)($body['productId']??0);$qty=(float)($body['quantity']??0);if(!$pid||$qty==0)throw new Exception('Produit ou quantité invalide.');$st=$pdo->prepare('SELECT stock FROM products WHERE id=? FOR UPDATE');$st->execute([$pid]);$prev=(float)$st->fetchColumn();$new=$prev+$qty;$pdo->prepare('UPDATE products SET stock=? WHERE id=?')->execute([$new,$pid]);$ref=nextRef($pdo,'MVM','stock_movements','reference');$type=$qty>0?'ENTREE':'AJUSTEMENT';$pdo->prepare('INSERT INTO stock_movements(product_id,user_id,reference,type,quantity,previous_stock,new_stock,reason) VALUES(?,?,?,?,?,?,?,?)')->execute([$pid,$userId,$ref,$type,$qty,$prev,$new,$body['reason']??'Ajustement de stock']);jsonResponse(true,'Mouvement de stock enregistré.');
    }

    jsonResponse(false,'Action inconnue.',[],404);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    failMsg($e);
}
