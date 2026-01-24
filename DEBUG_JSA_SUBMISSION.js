// Quick fix test: Check if observer_signatures is causing issues
// Add this console log right before the supabase update/insert to debug

console.log('JSA Form Payload:', {
  observer_signatures: form.observerSignatures,
  observer_signatures_length: form.observerSignatures?.length,
  observer_signatures_type: typeof form.observerSignatures,
  full_payload: payload
});
