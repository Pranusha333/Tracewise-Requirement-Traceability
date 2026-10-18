export function getHealth(_request, response) {
  response.json({ status: 'ok', message: 'Requirement Traceability API is running.' });
}
