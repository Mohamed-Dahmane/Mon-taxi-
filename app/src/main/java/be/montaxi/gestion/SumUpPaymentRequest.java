package be.montaxi.gestion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/**
 * Validation locale des demandes d'encaissement.
 * Aucun paiement n'est lancé par cette classe : le SDK SumUp sera branché séparément.
 */
public final class SumUpPaymentRequest {
    public final String requestId;
    public final long amountCents;
    public final String currency;

    private SumUpPaymentRequest(String requestId, long amountCents) {
        this.requestId = requestId;
        this.amountCents = amountCents;
        this.currency = "EUR";
    }

    public static SumUpPaymentRequest fromEuros(String amount) {
        if (amount == null || !amount.matches("[0-9]+(?:[.,][0-9]{1,2})?")) {
            throw new IllegalArgumentException("Montant invalide");
        }
        BigDecimal euros = new BigDecimal(amount.replace(',', '.'));
        if (euros.signum() <= 0 || euros.compareTo(new BigDecimal("99999.99")) > 0) {
            throw new IllegalArgumentException("Montant hors limites");
        }
        long cents = euros.movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        return new SumUpPaymentRequest(UUID.randomUUID().toString(), cents);
    }

    public BigDecimal euros() {
        return BigDecimal.valueOf(amountCents, 2);
    }
}
