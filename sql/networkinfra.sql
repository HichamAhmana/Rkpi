CREATE DATABASE IF NOT EXISTS app2_db;
USE app2_db;

CREATE TABLE Servers (
    ServerID INT AUTO_INCREMENT PRIMARY KEY,
    Hostname VARCHAR(100),
    IPAddress VARCHAR(50),
    Environment VARCHAR(50),
    Status VARCHAR(20)
);

CREATE TABLE Switches (
    SwitchID INT AUTO_INCREMENT PRIMARY KEY,
    SwitchName VARCHAR(100),
    Location VARCHAR(100),
    Status VARCHAR(20)
);

CREATE TABLE Ports (
    PortID INT AUTO_INCREMENT PRIMARY KEY,
    SwitchID INT,
    PortNumber VARCHAR(20),
    Status VARCHAR(20),
    SpeedMbps INT,
    FOREIGN KEY (SwitchID) REFERENCES Switches(SwitchID)
);

CREATE TABLE MaintenanceLogs (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    ServerID INT NULL,
    SwitchID INT NULL,
    MaintenanceDate DATETIME,
    Description VARCHAR(500),
    PerformedBy VARCHAR(100),
    FOREIGN KEY (ServerID) REFERENCES Servers(ServerID),
    FOREIGN KEY (SwitchID) REFERENCES Switches(SwitchID)
);