-- ============================================================================
-- SIMULADOR BANCARIO WEB - database.sql
-- Importar en una base de datos VACÍA (en Hostinger: phpMyAdmin > Importar).
-- Cambios frente a banco_completo.sql:
--   * Solo cuentas de AHORROS (decisión 4 del documento)
--   * El estado pertenece a la CUENTA, no al cliente (decisión 6)
--   * Contraseñas con hash bcrypt real (7 dígitos numéricos)
--   * Sin DROP/CREATE DATABASE (Hostinger crea la base desde hPanel)
-- ============================================================================

CREATE TABLE usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  rol ENUM('CLIENTE','ADMIN') NOT NULL DEFAULT 'CLIENTE',
  correo VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(15),
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cambio_clave BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta DATETIME NULL,
  CONSTRAINT chk_intentos_fallidos CHECK (intentos_fallidos >= 0)
) ENGINE=InnoDB;

CREATE TABLE cuentas (
  id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
  numero_cuenta VARCHAR(20) NOT NULL UNIQUE,
  id_usuario INT NOT NULL,
  tipo_cuenta ENUM('AHORROS') NOT NULL DEFAULT 'AHORROS',
  saldo BIGINT NOT NULL DEFAULT 0,
  estado ENUM('ACTIVO','INACTIVO','BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_saldo CHECK (saldo >= 0),
  CONSTRAINT fk_cuentas_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE transferencias (
  id_transferencia INT AUTO_INCREMENT PRIMARY KEY,
  id_cuenta_origen INT NOT NULL,
  id_cuenta_destino INT NOT NULL,
  valor BIGINT NOT NULL,
  descripcion VARCHAR(150),
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_valor_transferencia CHECK (valor > 0),
  CONSTRAINT chk_cuentas_distintas CHECK (id_cuenta_origen <> id_cuenta_destino),
  CONSTRAINT fk_transferencias_origen FOREIGN KEY (id_cuenta_origen)
    REFERENCES cuentas(id_cuenta) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transferencias_destino FOREIGN KEY (id_cuenta_destino)
    REFERENCES cuentas(id_cuenta) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE movimientos (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_cuenta INT NOT NULL,
  id_transferencia INT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo ENUM('CONSIGNACION','RETIRO','TRANSFERENCIA_ENVIADA','TRANSFERENCIA_RECIBIDA') NOT NULL,
  descripcion VARCHAR(150),
  valor BIGINT NOT NULL,
  saldo_resultante BIGINT NOT NULL,
  CONSTRAINT chk_valor_movimiento CHECK (valor <> 0),
  CONSTRAINT chk_saldo_resultante CHECK (saldo_resultante >= 0),
  CONSTRAINT fk_movimientos_cuenta FOREIGN KEY (id_cuenta)
    REFERENCES cuentas(id_cuenta) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_movimientos_transferencia FOREIGN KEY (id_transferencia)
    REFERENCES transferencias(id_transferencia) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_movimientos_cuenta_fecha ON movimientos(id_cuenta, fecha);
CREATE INDEX idx_transferencias_fecha ON transferencias(fecha);

-- ----------------------------------------------------------------------------
-- DATOS DE PRUEBA
-- Claves (7 dígitos): admin_banco=1234567, laura.gomez=2222222,
-- andres.ramirez=3333333 (debe cambiarla al entrar), sofia.castro=4444444
-- ----------------------------------------------------------------------------
INSERT INTO usuarios (nombre, apellidos, usuario, contrasena, rol, correo, telefono, cambio_clave) VALUES
('Carlos', 'Mendoza Ruiz', 'admin_banco', '$2b$10$PBlG3eucJA01kQDBi1LwgOSWdOo1FgOOO1A.JwFEMEKBVWYMtqOoG', 'ADMIN', 'admin@banco.com', '3001112233', FALSE),
('Laura', 'Gómez Pérez', 'laura.gomez', '$2b$10$d8zZ5G6c3cRFYQCBWs/hjuqK6xSPELVyOe53W7OfS29J07IYvpLJq', 'CLIENTE', 'laura.gomez@email.com', '3104445566', FALSE),
('Andrés', 'Ramírez Soto', 'andres.ramirez', '$2b$10$0gOjd/mQeX/YHE1bSUsMaeZjk2/6.HpxQuH.wmDmwbHvvUog1c7C2', 'CLIENTE', 'andres.ramirez@email.com', '3207778899', TRUE),
('Sofía', 'Castro López', 'sofia.castro', '$2b$10$BuqGE8M4L6HYHXam9pwKHux2pBigFJNhtKIk3c98RdQjHvVHIJDSC', 'CLIENTE', 'sofia.castro@email.com', '3159990011', FALSE);

INSERT INTO cuentas (numero_cuenta, id_usuario, tipo_cuenta, saldo, estado) VALUES
('1001000001', 2, 'AHORROS', 1200000, 'ACTIVO'),
('1001000002', 2, 'AHORROS', 500000, 'ACTIVO'),
('1001000003', 3, 'AHORROS', 1100000, 'ACTIVO'),
('1001000004', 4, 'AHORROS', 250000, 'BLOQUEADO');

INSERT INTO movimientos (id_cuenta, id_transferencia, tipo, descripcion, valor, saldo_resultante) VALUES
(1, NULL, 'CONSIGNACION', 'Depósito inicial apertura de cuenta', 1500000, 1500000),
(2, NULL, 'CONSIGNACION', 'Depósito inicial cuenta de ahorros', 500000, 500000),
(3, NULL, 'CONSIGNACION', 'Depósito inicial apertura de cuenta', 1000000, 1000000),
(4, NULL, 'CONSIGNACION', 'Depósito inicial apertura de cuenta', 250000, 250000),
(1, NULL, 'RETIRO', 'Retiro cajero', -100000, 1400000);

INSERT INTO transferencias (id_cuenta_origen, id_cuenta_destino, valor, descripcion) VALUES
(1, 3, 200000, 'Pago de arriendo mensual');

INSERT INTO movimientos (id_cuenta, id_transferencia, tipo, descripcion, valor, saldo_resultante) VALUES
(1, 1, 'TRANSFERENCIA_ENVIADA', 'Transferencia a cuenta 1001000003 - Pago de arriendo mensual', -200000, 1200000),
(3, 1, 'TRANSFERENCIA_RECIBIDA', 'Transferencia desde cuenta 1001000001 - Pago de arriendo mensual', 200000, 1200000);

INSERT INTO movimientos (id_cuenta, id_transferencia, tipo, descripcion, valor, saldo_resultante) VALUES
(3, NULL, 'RETIRO', 'Compra en datáfono', -100000, 1100000);
