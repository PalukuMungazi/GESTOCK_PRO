// Données de démonstration reprises du projet Figma Make.
// Elles sont conservées dans localStorage pour que le front-end HTML/CSS/JS
// puisse être testé sans PHP/MySQL. La connexion MySQL sera ajoutée plus tard.

const SEED = {
  categories: [
    {id:1,name:'Alimentation',description:'Produits alimentaires et boissons',products:45,status:'Actif'},
    {id:2,name:'Hygiène & Beauté',description:'Produits de soin et cosmétiques',products:32,status:'Actif'},
    {id:3,name:'Électronique',description:'Appareils et accessoires électroniques',products:18,status:'Actif'},
    {id:4,name:'Papeterie',description:'Fournitures de bureau et scolaires',products:24,status:'Actif'},
    {id:5,name:'Ménager',description:'Articles de maison et cuisine',products:29,status:'Actif'},
    {id:6,name:'Textile',description:'Vêtements et accessoires',products:15,status:'Inactif'}
  ],
  suppliers: [
    {id:1,name:'SODECI Distribution',contact:'Amadou Koné',phone:'+225 07 00 11 22',email:'amadou@sodeci.ci',address:'Abidjan, Plateau',purchases:24,total:4850000,balance:120000,status:'Actif'},
    {id:2,name:'Grands Moulins d\'Abidjan',contact:'Marie Bamba',phone:'+225 05 44 33 22',email:'mbamba@gma.ci',address:'Abidjan, Yopougon',purchases:18,total:2300000,balance:0,status:'Actif'},
    {id:3,name:'CFAO Motors',contact:'Jean-Pierre Diallo',phone:'+225 27 21 55 66',email:'jp.diallo@cfao.com',address:'Abidjan, Marcory',purchases:7,total:890000,balance:45000,status:'Actif'},
    {id:4,name:'Pharmivoire',contact:'Dr. Awa Traoré',phone:'+225 07 77 88 99',email:'atraore@pharmivoire.ci',address:'Abidjan, Cocody',purchases:31,total:6200000,balance:0,status:'Actif'},
    {id:5,name:'MECI Papeterie',contact:'Rachid Ouattara',phone:'+225 01 23 45 67',email:'rouattara@meci.ci',address:'Abidjan, Adjamé',purchases:12,total:780000,balance:95000,status:'Inactif'}
  ],
  customers: [
    {id:1,code:'CLI-001',name:'Kouassi Emmanuel',phone:'+225 07 11 22 33',email:'kouassi.e@gmail.com',address:'Abidjan, Abobo',totalPurchases:850000,paid:820000,balance:30000,status:'Actif'},
    {id:2,code:'CLI-002',name:'Fatou Camara',phone:'+225 05 44 55 66',email:'fatou.c@yahoo.fr',address:'Abidjan, Treichville',totalPurchases:1240000,paid:1240000,balance:0,status:'Actif'},
    {id:3,code:'CLI-003',name:'Restaurant Le Palmier',phone:'+225 27 33 44 55',email:'contact@lepalmier.ci',address:'Abidjan, Plateau',totalPurchases:3200000,paid:2900000,balance:300000,status:'Actif'},
    {id:4,code:'CLI-004',name:'Ibrahim Coulibaly',phone:'+225 01 22 33 44',email:'ibrahim.c@gmail.com',address:'Abidjan, Yopougon',totalPurchases:450000,paid:450000,balance:0,status:'Actif'},
    {id:5,code:'CLI-005',name:'Marché Gouro SARL',phone:'+225 27 66 77 88',email:'marchegouro@ci.ci',address:'Abidjan, Adjamé',totalPurchases:5600000,paid:5100000,balance:500000,status:'Inactif'}
  ],
  products: [
    {id:1,code:'PRD-001',name:'Riz Parfumé 25kg',category:'Alimentation',purchasePrice:18500,salePrice:21000,stock:85,minStock:20,unit:'Sac',supplier:'Grands Moulins d\'Abidjan',status:'En stock'},
    {id:2,code:'PRD-002',name:'Huile végétale 5L',category:'Alimentation',purchasePrice:4200,salePrice:5000,stock:12,minStock:15,unit:'Bidon',supplier:'SODECI Distribution',status:'Stock faible'},
    {id:3,code:'PRD-003',name:'Savon Lux (lot 12)',category:'Hygiène & Beauté',purchasePrice:3600,salePrice:4500,stock:0,minStock:10,unit:'Lot',supplier:'SODECI Distribution',status:'Rupture'},
    {id:4,code:'PRD-004',name:'Sucre cristallisé 50kg',category:'Alimentation',purchasePrice:32000,salePrice:36500,stock:34,minStock:10,unit:'Sac',supplier:'Grands Moulins d\'Abidjan',status:'En stock'},
    {id:5,code:'PRD-005',name:'Cahier 100 pages (lot 10)',category:'Papeterie',purchasePrice:1800,salePrice:2500,stock:7,minStock:15,unit:'Lot',supplier:'MECI Papeterie',status:'Stock faible'},
    {id:6,code:'PRD-006',name:'Lait concentré sucré',category:'Alimentation',purchasePrice:650,salePrice:850,stock:120,minStock:30,unit:'Boîte',supplier:'SODECI Distribution',status:'En stock'},
    {id:7,code:'PRD-007',name:'Détergent OMO 1kg',category:'Ménager',purchasePrice:1200,salePrice:1600,stock:45,minStock:20,unit:'Paquet',supplier:'SODECI Distribution',status:'En stock'},
    {id:8,code:'PRD-008',name:'Stylo Bille (lot 12)',category:'Papeterie',purchasePrice:900,salePrice:1200,stock:3,minStock:10,unit:'Lot',supplier:'MECI Papeterie',status:'Stock faible'},
    {id:9,code:'PRD-009',name:'Farine de blé 25kg',category:'Alimentation',purchasePrice:14000,salePrice:16500,stock:22,minStock:10,unit:'Sac',supplier:'Grands Moulins d\'Abidjan',status:'En stock'},
    {id:10,code:'PRD-010',name:'Eau minérale 1.5L (cas)',category:'Alimentation',purchasePrice:3200,salePrice:4000,stock:0,minStock:20,unit:'Cas',supplier:'SODECI Distribution',status:'Rupture'}
  ],
  purchases: [
    {id:1,ref:'ACH-2024-001',date:'2024-01-15',supplier:'SODECI Distribution',items:8,total:285000,paid:285000,remaining:0,status:'Payé',user:'Admin'},
    {id:2,ref:'ACH-2024-002',date:'2024-01-18',supplier:'Grands Moulins d\'Abidjan',items:4,total:148000,paid:100000,remaining:48000,status:'Partiellement payé',user:'Gérant'},
    {id:3,ref:'ACH-2024-003',date:'2024-01-20',supplier:'MECI Papeterie',items:6,total:54000,paid:0,remaining:54000,status:'Non payé',user:'Admin'},
    {id:4,ref:'ACH-2024-004',date:'2024-01-22',supplier:'SODECI Distribution',items:12,total:420000,paid:420000,remaining:0,status:'Payé',user:'Admin'},
    {id:5,ref:'ACH-2024-005',date:'2024-01-25',supplier:'Pharmivoire',items:20,total:890000,paid:500000,remaining:390000,status:'Partiellement payé',user:'Gérant'}
  ],
  sales: [
    {id:1,ref:'VTE-2024-001',date:'2024-01-25 08:32',customer:'Kouassi Emmanuel',items:3,total:27500,paid:27500,remaining:0,method:'Espèces',status:'Payé',cashier:'Aicha Koné'},
    {id:2,ref:'VTE-2024-002',date:'2024-01-25 09:14',customer:'Comptant',items:5,total:42000,paid:42000,remaining:0,method:'Mobile Money',status:'Payé',cashier:'Aicha Koné'},
    {id:3,ref:'VTE-2024-003',date:'2024-01-25 10:05',customer:'Restaurant Le Palmier',items:15,total:185000,paid:100000,remaining:85000,method:'Virement',status:'Partiellement payé',cashier:'Aicha Koné'},
    {id:4,ref:'VTE-2024-004',date:'2024-01-25 11:22',customer:'Fatou Camara',items:2,total:9500,paid:9500,remaining:0,method:'Espèces',status:'Payé',cashier:'Moussa Bah'},
    {id:5,ref:'VTE-2024-005',date:'2024-01-25 13:45',customer:'Comptant',items:7,total:63000,paid:63000,remaining:0,method:'Espèces',status:'Payé',cashier:'Moussa Bah'},
    {id:6,ref:'VTE-2024-006',date:'2024-01-25 14:30',customer:'Ibrahim Coulibaly',items:4,total:34000,paid:34000,remaining:0,method:'Carte bancaire',status:'Payé',cashier:'Aicha Koné'}
  ],
  stockMovements: [
    {id:1,date:'2024-01-25 08:00',ref:'MVM-001',product:'Riz Parfumé 25kg',type:'Vente',qty:-3,prevStock:88,newStock:85,reason:'Vente VTE-2024-001',user:'Aicha Koné'},
    {id:2,date:'2024-01-25 09:00',ref:'MVM-002',product:'Huile végétale 5L',type:'Vente',qty:-2,prevStock:14,newStock:12,reason:'Vente VTE-2024-002',user:'Aicha Koné'},
    {id:3,date:'2024-01-24 16:00',ref:'MVM-003',product:'Sucre cristallisé 50kg',type:'Achat',qty:10,prevStock:24,newStock:34,reason:'Achat ACH-2024-004',user:'Admin'},
    {id:4,date:'2024-01-24 14:00',ref:'MVM-004',product:'Détergent OMO 1kg',type:'Achat',qty:20,prevStock:25,newStock:45,reason:'Achat ACH-2024-004',user:'Admin'},
    {id:5,date:'2024-01-23 11:00',ref:'MVM-005',product:'Cahier 100 pages',type:'Ajustement',qty:-3,prevStock:10,newStock:7,reason:'Inventaire - produits endommagés',user:'Gérant'},
    {id:6,date:'2024-01-22 09:00',ref:'MVM-006',product:'Lait concentré sucré',type:'Entrée',qty:50,prevStock:70,newStock:120,reason:'Entrée de stock',user:'Admin'}
  ],
  cashTransactions: [
    {id:1,date:'2024-01-25 08:32',ref:'CAI-001',type:'Vente',description:'Vente VTE-2024-001',entree:27500,sortie:0,solde:1452500,user:'Aicha Koné'},
    {id:2,date:'2024-01-25 09:14',ref:'CAI-002',type:'Vente',description:'Vente VTE-2024-002',entree:42000,sortie:0,solde:1494500,user:'Aicha Koné'},
    {id:3,date:'2024-01-25 10:30',ref:'CAI-003',type:'Dépense',description:'Frais transport livraison',entree:0,sortie:15000,solde:1479500,user:'Admin'},
    {id:4,date:'2024-01-25 11:22',ref:'CAI-004',type:'Vente',description:'Vente VTE-2024-004',entree:9500,sortie:0,solde:1489000,user:'Moussa Bah'},
    {id:5,date:'2024-01-25 13:45',ref:'CAI-005',type:'Vente',description:'Vente VTE-2024-005',entree:63000,sortie:0,solde:1552000,user:'Moussa Bah'},
    {id:6,date:'2024-01-25 14:30',ref:'CAI-006',type:'Vente',description:'Vente VTE-2024-006',entree:34000,sortie:0,solde:1586000,user:'Aicha Koné'},
    {id:7,date:'2024-01-25 15:00',ref:'CAI-007',type:'Achat',description:'Paiement fournisseur SODECI',entree:0,sortie:285000,solde:1301000,user:'Admin'}
  ],
  users: [
    {id:1,name:'Administrateur Système',email:'admin@gestock.ci',username:'admin',role:'Administrateur',status:'Actif',lastLogin:'2024-01-25 14:30'},
    {id:2,name:'Aicha Koné',email:'aicha.kone@gestock.ci',username:'aicha.k',role:'Caissier',status:'Actif',lastLogin:'2024-01-25 08:00'},
    {id:3,name:'Moussa Bah',email:'moussa.bah@gestock.ci',username:'moussa.b',role:'Caissier',status:'Actif',lastLogin:'2024-01-25 09:00'},
    {id:4,name:'Yves Kouamé',email:'yves.kouame@gestock.ci',username:'yves.k',role:'Gérant',status:'Actif',lastLogin:'2024-01-24 17:45'},
    {id:5,name:'Mariam Touré',email:'mariam.toure@gestock.ci',username:'mariam.t',role:'Gestionnaire de stock',status:'Inactif',lastLogin:'2024-01-10 10:00'}
  ]
};

const salesChartData = [
  {day:'Lun',ventes:185000,achats:120000},{day:'Mar',ventes:220000,achats:85000},
  {day:'Mer',ventes:167000,achats:200000},{day:'Jeu',ventes:310000,achats:150000},
  {day:'Ven',ventes:280000,achats:90000},{day:'Sam',ventes:420000,achats:180000},
  {day:'Dim',ventes:176000,achats:60000}
];
