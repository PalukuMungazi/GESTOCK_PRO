<?php
require_once __DIR__ . '/helpers/auth.php';
requireLogin();

// -----------------------------------------------------------------------------
// GESTOCK PRO - Générateur PDF simple sans bibliothèque externe.
// Il reçoit les lignes du rapport depuis JavaScript et produit un vrai fichier PDF.
// -----------------------------------------------------------------------------
header('Content-Type: application/pdf; charset=UTF-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { http_response_code(400); exit('Données PDF invalides.'); }

$title = trim((string)($data['title'] ?? 'Rapport GESTOCK PRO'));
$from = trim((string)($data['from'] ?? ''));
$to = trim((string)($data['to'] ?? ''));
$headers = is_array($data['headers'] ?? null) ? $data['headers'] : [];
$rows = is_array($data['rows'] ?? null) ? $data['rows'] : [];

function pdfText(string $s): string {
    // Helvetica standard utilise une police proche de Windows-1252.
    $s = iconv('UTF-8', 'Windows-1252//TRANSLIT', $s);
    $s = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
    return $s;
}
function wrapText(string $text, int $max = 34): array {
    $text = trim(preg_replace('/\s+/', ' ', $text));
    if ($text === '') return [''];
    $words = explode(' ', $text); $lines=[]; $line='';
    foreach($words as $w){
        if(strlen($line)+strlen($w)+1 <= $max) $line .= ($line===''?'':' ').$w;
        else { if($line!=='') $lines[]=$line; $line=$w; }
    }
    if($line!=='') $lines[]=$line;
    return $lines ?: [''];
}

// Colonnes compactes pour rester lisible sur A4 paysage.
$cols = count($headers);
$widths = $cols ? array_fill(0, $cols, 10) : [];
foreach($headers as $i=>$h) $widths[$i]=max(10,min(24,strlen(iconv('UTF-8','Windows-1252//TRANSLIT',(string)$h))));
foreach($rows as $row){ foreach($widths as $i=>$w){ $v=isset($row[$i])?(string)$row[$i]:''; $len=strlen(iconv('UTF-8','Windows-1252//TRANSLIT',$v)); $widths[$i]=max($widths[$i],min(24,$len)); } }
$totalW=array_sum($widths)+($cols-1)*2; if($totalW>150){ $factor=150/$totalW; foreach($widths as &$w)$w=max(7,(int)floor($w*$factor)); unset($w); }

$pages=[]; $linesPerPage=34; $current=[];
$current[]=$title;
$current[]='Période : '.($from!==''?$from:'Toutes les dates').' au '.($to!==''?$to:'Toutes les dates');
$current[]='Généré par GESTOCK PRO';
$current[]='';
if($cols){
    $head=''; foreach($headers as $i=>$h){$head.=str_pad(substr(iconv('UTF-8','Windows-1252//TRANSLIT',(string)$h),0,$widths[$i]),$widths[$i]).'  ';} $current[]=rtrim($head);
    $current[]=str_repeat('-', min(150, $totalW));
}
foreach($rows as $row){
    $wrapped=[];
    foreach($widths as $i=>$w){
        $cell=isset($row[$i])?(string)$row[$i]:'';
        $wrapped[$i]=wrapText($cell,max(8,$w));
    }
    $height=1; foreach($wrapped as $ls)$height=max($height,count($ls));
    for($line=0;$line<$height;$line++){
        $out=''; foreach($widths as $i=>$w){$v=$wrapped[$i][$line]??'';$out.=str_pad(substr(iconv('UTF-8','Windows-1252//TRANSLIT',$v),0,$w),$w).'  ';} $current[]=rtrim($out);
        if(count($current)>=$linesPerPage){$pages[]=$current;$current=[];}
    }
}
if($current) $pages[]=$current;
if(!$pages) $pages=[['Rapport vide.']];

// Construction PDF minimale et valide.
$objects=[]; $objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
$pageNums=[]; $fontNum=3; $next=4;
$objects[2]='';
$objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
foreach($pages as $pi=>$pageLines){
    $content="BT\n/F1 8 Tf\n40 560 Td\n";
    foreach($pageLines as $idx=>$line){
        if($idx>0) $content.="0 -15 Td\n";
        $content.='('.pdfText($line).") Tj\n";
    }
    $content.="ET\n";
    $cNum=$next++; $pNum=$next++;
    $objects[$cNum]="<< /Length ".strlen($content)." >>\nstream\n".$content."endstream";
    $objects[$pNum]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {$cNum} 0 R >>";
    $pageNums[]=$pNum;
}
$kids=implode(' ',array_map(fn($n)=>$n.' 0 R',$pageNums)); $objects[2]="<< /Type /Pages /Kids [ $kids ] /Count ".count($pageNums)." >>";
ksort($objects);
$pdf="%PDF-1.4\n"; $offsets=[0]; $max=max(array_keys($objects));
for($i=1;$i<=$max;$i++){ $offsets[$i]=strlen($pdf); $pdf.=$i." 0 obj\n".($objects[$i]??'')."\nendobj\n"; }
$xref=strlen($pdf); $pdf.="xref\n0 ".($max+1)."\n0000000000 65535 f \n"; for($i=1;$i<=$max;$i++)$pdf.=sprintf('%010d 00000 n \n',$offsets[$i]);
$pdf.="trailer\n<< /Size ".($max+1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

$filename='gestock-rapport-'.preg_replace('/[^a-z0-9_-]+/i','-',strtolower($title)).'.pdf';
header('Content-Disposition: attachment; filename="'.$filename.'"');
echo $pdf;
