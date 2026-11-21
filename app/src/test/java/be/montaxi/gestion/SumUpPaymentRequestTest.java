package be.montaxi.gestion;

import org.junit.Test;
import static org.junit.Assert.*;

public class SumUpPaymentRequestTest {
    @Test public void acceptsEuroAmounts() {
        assertEquals(100L, SumUpPaymentRequest.fromEuros("1").amountCents);
        assertEquals(169L, SumUpPaymentRequest.fromEuros("1,69").amountCents);
        assertEquals(12345L, SumUpPaymentRequest.fromEuros("123.45").amountCents);
        assertEquals("EUR", SumUpPaymentRequest.fromEuros("1").currency);
    }

    @Test public void givesEachRequestItsOwnIdentifier() {
        assertNotEquals(SumUpPaymentRequest.fromEuros("10").requestId,
                        SumUpPaymentRequest.fromEuros("10").requestId);
    }

    @Test public void rejectsInvalidAmounts() {
        String[] bad = {null, "", "0", "-1", "1.234", "abc", "100000", "1e3", "1 000"};
        for (String amount : bad) {
            try {
                SumUpPaymentRequest.fromEuros(amount);
                fail("Montant invalide accepté : " + amount);
            } catch (IllegalArgumentException expected) {}
        }
    }
}
