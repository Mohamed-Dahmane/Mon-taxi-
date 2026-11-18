// Offline schema compatibility gate. No database access or writes.
export function assessUberImportSchema(columns) {
  if (!Array.isArray(columns)) throw new Error('Schema inventory required');
  const has = (table, column) => columns.some(c => c.table_name === table && c.column_name === column);
  const staging = 'taxi_uber_driver_earnings_staging';
  const payments = 'taxi_uber_payments';
  const missing = [];
  for (const c of ['driver_external_id','external_payment_id','net_cents','local_service_date','source']) if (!has(staging,c)) missing.push(staging+'.'+c);
  for (const c of ['user_id','payment_id','amount_cents','cash_collected_cents']) if (!has(payments,c)) missing.push(payments+'.'+c);
  // A driver ID in staging does not establish ownership of the Mon Taxi user.
  // A user ID in payments does not prove which Uber driver produced a payment.
  const ownershipMappingVerified = has(staging,'user_id') && has(payments,'driver_external_id');
  return Object.freeze({readyForAutomaticPosting:false,missing:Object.freeze(missing),
    ownershipMappingVerified,reason: missing.length ? 'Required columns missing' :
    !ownershipMappingVerified ? 'No verified user-to-driver ownership mapping across tables' :
    'Requires official Uber authorization, persistent unique constraint, atomic transaction and accounting review'});
}
