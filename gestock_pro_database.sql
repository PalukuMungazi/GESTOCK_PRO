-- ============================================================
-- GESTOCK PRO - Base de données MySQL
-- Front-end : HTML / CSS / JavaScript
-- Back-end prévu : PHP
-- Serveur : WampServer / MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestock_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gestock_pro;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS cash_transactions;
DROP TABLE IF EXISTS cash_sessions;
DROP TABLE IF EXISTS sale_payments;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS purchase_payments;
DROP TABLE IF EXISTS purchase_items;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS company_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. UTILISATEURS
-- ============================================================
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status ENUM('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
    last_login DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- 3. CATEGORIES
-- ============================================================
CREATE TABLE categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    status ENUM('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 4. FOURNISSEURS
-- ============================================================
CREATE TABLE suppliers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    status ENUM('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_suppliers_name (name)
) ENGINE=InnoDB;

-- ============================================================
-- 5. CLIENTS
-- ============================================================
CREATE TABLE customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    status ENUM('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customers_name (name),
    INDEX idx_customers_phone (phone)
) ENGINE=InnoDB;

-- ============================================================
-- 6. PRODUITS
-- Le stock actuel est conservé pour un accès rapide.
-- Les mouvements restent la source de traçabilité.
-- ============================================================
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    supplier_id INT UNSIGNED NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    sale_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stock DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    min_stock DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    tva DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    unit VARCHAR(30) NOT NULL DEFAULT 'Pcs',
    status ENUM('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_products_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_products_name (name),
    INDEX idx_products_category (category_id),
    INDEX idx_products_supplier (supplier_id)
) ENGINE=InnoDB;

-- ============================================================
-- 7. ACHATS (entête)
-- ============================================================
CREATE TABLE purchases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    reference VARCHAR(50) NOT NULL UNIQUE,
    purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status ENUM('NON_PAYE','PARTIELLEMENT_PAYE','PAYE','ANNULE') NOT NULL DEFAULT 'NON_PAYE',
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchases_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_purchases_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_purchases_date (purchase_date),
    INDEX idx_purchases_supplier (supplier_id),
    INDEX idx_purchases_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 8. DETAILS DES ACHATS
-- ============================================================
CREATE TABLE purchase_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_purchase_items_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_purchase_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_purchase_items_purchase (purchase_id),
    INDEX idx_purchase_items_product (product_id)
) ENGINE=InnoDB;

-- ============================================================
-- 9. PAIEMENTS FOURNISSEURS
-- ============================================================
CREATE TABLE purchase_payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('ESPECES','MOBILE_MONEY','VIREMENT','CARTE','AUTRE') NOT NULL DEFAULT 'ESPECES',
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(100) NULL,
    notes VARCHAR(255) NULL,
    CONSTRAINT fk_purchase_payments_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_purchase_payments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_purchase_payments_purchase (purchase_id),
    INDEX idx_purchase_payments_date (payment_date)
) ENGINE=InnoDB;

-- ============================================================
-- 10. VENTES (entête)
-- ============================================================
CREATE TABLE sales (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    reference VARCHAR(50) NOT NULL UNIQUE,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tva_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    payment_method ENUM('ESPECES','MOBILE_MONEY','VIREMENT','CARTE','CREDIT','AUTRE') NOT NULL DEFAULT 'ESPECES',
    status ENUM('NON_PAYE','PARTIELLEMENT_PAYE','PAYE','ANNULE') NOT NULL DEFAULT 'NON_PAYE',
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_sales_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_sales_date (sale_date),
    INDEX idx_sales_customer (customer_id),
    INDEX idx_sales_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 11. DETAILS DES VENTES
-- ============================================================
CREATE TABLE sale_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tva DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    total_price DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (sale_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_sale_items_sale (sale_id),
    INDEX idx_sale_items_product (product_id)
) ENGINE=InnoDB;

-- ============================================================
-- 12. PAIEMENTS CLIENTS
-- ============================================================
CREATE TABLE sale_payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('ESPECES','MOBILE_MONEY','VIREMENT','CARTE','AUTRE') NOT NULL DEFAULT 'ESPECES',
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(100) NULL,
    notes VARCHAR(255) NULL,
    CONSTRAINT fk_sale_payments_sale
        FOREIGN KEY (sale_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sale_payments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_sale_payments_sale (sale_id),
    INDEX idx_sale_payments_date (payment_date)
) ENGINE=InnoDB;

-- ============================================================
-- 13. SESSIONS DE CAISSE
-- ============================================================
CREATE TABLE cash_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    opening_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closing_date DATETIME NULL,
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    theoretical_balance DECIMAL(15,2) NULL,
    counted_balance DECIMAL(15,2) NULL,
    difference DECIMAL(15,2) NULL,
    status ENUM('OUVERTE','FERMEE') NOT NULL DEFAULT 'OUVERTE',
    notes TEXT NULL,
    CONSTRAINT fk_cash_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_cash_sessions_status (status),
    INDEX idx_cash_sessions_opening (opening_date)
) ENGINE=InnoDB;

-- ============================================================
-- 14. TRANSACTIONS DE CAISSE
-- ============================================================
CREATE TABLE cash_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cash_session_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    sale_id INT UNSIGNED NULL,
    purchase_id INT UNSIGNED NULL,
    reference VARCHAR(50) NOT NULL UNIQUE,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type ENUM('VENTE','ACHAT','ENTREE','DEPENSE','RETRAIT','AUTRE') NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    direction ENUM('ENTREE','SORTIE') NOT NULL,
    balance_after DECIMAL(15,2) NULL,
    payment_method ENUM('ESPECES','MOBILE_MONEY','VIREMENT','CARTE','AUTRE') NOT NULL DEFAULT 'ESPECES',
    CONSTRAINT fk_cash_transactions_session
        FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_cash_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cash_transactions_sale
        FOREIGN KEY (sale_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_cash_transactions_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_cash_transactions_date (transaction_date),
    INDEX idx_cash_transactions_type (type),
    INDEX idx_cash_transactions_session (cash_session_id)
) ENGINE=InnoDB;

-- ============================================================
-- 15. MOUVEMENTS DE STOCK
-- ============================================================
CREATE TABLE stock_movements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    purchase_id INT UNSIGNED NULL,
    sale_id INT UNSIGNED NULL,
    reference VARCHAR(50) NOT NULL UNIQUE,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type ENUM('ENTREE','SORTIE','VENTE','ACHAT','AJUSTEMENT','RETOUR') NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    previous_stock DECIMAL(15,3) NOT NULL,
    new_stock DECIMAL(15,3) NOT NULL,
    reason VARCHAR(255) NULL,
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_stock_movements_sale
        FOREIGN KEY (sale_id) REFERENCES sales(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_stock_movements_product (product_id),
    INDEX idx_stock_movements_date (movement_date),
    INDEX idx_stock_movements_type (type)
) ENGINE=InnoDB;

-- ============================================================
-- 16. PARAMETRES DE L'ENTREPRISE
-- ============================================================
CREATE TABLE company_settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL DEFAULT 'GESTOCK PRO',
    phone VARCHAR(50) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT '$',
    tax_number VARCHAR(100) NULL,
    notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    auto_backup_enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- DONNEES INITIALES MINIMALES
-- ============================================================
INSERT INTO roles (name, description) VALUES
('Administrateur', 'Accès complet à l’application'),
('Caissier', 'Ventes et opérations de caisse'),
('Gérant', 'Gestion commerciale et rapports'),
('Gestionnaire de stock', 'Produits, achats et mouvements de stock');

-- Mot de passe de démonstration : admin
-- Il devra être remplacé/changé via PHP lors de la mise en production.
INSERT INTO users (role_id, name, email, username, password, status)
SELECT id, 'Administrateur Système', 'admin@gestock.pro', 'admin',
       '$2y$12$Qq9PMU2jiLlqfh2dTLBmI.z.FG419BdVcEjtCqgdi8FxQ9cj3tSA.', 'ACTIF'
FROM roles WHERE name = 'Administrateur';

INSERT INTO company_settings
(company_name, phone, email, address, currency, tax_number, notifications_enabled, auto_backup_enabled)
VALUES
('GESTOCK PRO', '+243 000 000 000', 'contact@gestock.pro', 'Goma, RDC', '$', NULL, 1, 0);

-- ============================================================
-- VUES UTILES POUR LE FUTUR BACK-END PHP
-- ============================================================

CREATE OR REPLACE VIEW v_product_status AS
SELECT
    p.id,
    p.code,
    p.name,
    p.stock,
    p.min_stock,
    CASE
        WHEN p.stock <= 0 THEN 'Rupture'
        WHEN p.stock <= p.min_stock THEN 'Stock faible'
        ELSE 'En stock'
    END AS stock_status
FROM products p;

CREATE OR REPLACE VIEW v_customer_balances AS
SELECT
    c.id,
    c.code,
    c.name,
    COALESCE(SUM(s.total_amount), 0) AS total_purchases,
    COALESCE(SUM(s.paid_amount), 0) AS paid,
    COALESCE(SUM(s.remaining_amount), 0) AS balance
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id AND s.status <> 'ANNULE'
GROUP BY c.id, c.code, c.name;

CREATE OR REPLACE VIEW v_supplier_balances AS
SELECT
    sp.id,
    sp.name,
    COUNT(p.id) AS purchases_count,
    COALESCE(SUM(p.total_amount), 0) AS total_purchases,
    COALESCE(SUM(p.paid_amount), 0) AS paid,
    COALESCE(SUM(p.remaining_amount), 0) AS balance
FROM suppliers sp
LEFT JOIN purchases p ON p.supplier_id = sp.id AND p.status <> 'ANNULE'
GROUP BY sp.id, sp.name;

-- ============================================================
-- FIN
-- ============================================================
