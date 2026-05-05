import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.STRESS_BASE_URL || 'http://localhost:3000';

export const options = { vus: 200, duration: '30s' };

export default function () {
  const response = http.post(`${baseUrl}/sales/sale_sneaker_001/reservations`, null, {
    headers: {
      'x-user-token': `usr_tok_${__VU}_${__ITER}`,
      'idempotency-key': `${__VU}-${__ITER}`
    }
  });

  check(response, {
    'response is handled': (current) => [200, 409].includes(current.status)
  });
}