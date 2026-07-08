## MODIFIED Requirements

### Requirement: Device registration stores consistent ID
The system SHALL store the same device ID in `trusted_devices` that it returns in the registration response.

#### Scenario: Device registered and then listed
- **WHEN** a client calls the device registration endpoint
- **THEN** the system SHALL generate a new unique device ID
- **THEN** the response `device_id` field SHALL match the ID stored in `trusted_devices`
- **THEN** listing trusted devices SHALL include a device with that exact ID

#### Scenario: Device revocation works after registration
- **WHEN** a device was registered and its ID is used to call the revoke endpoint
- **THEN** the system SHALL remove the correct device from `trusted_devices`
- **THEN** tokens issued to that device SHALL be invalidated
