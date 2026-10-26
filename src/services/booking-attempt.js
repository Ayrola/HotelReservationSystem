// One immutable request per attempt; unknown outcomes must be reconciled before replay.
export function createBookingAttempt({ create,reconcile,persist,clear,uuid,initial = null }) {
  let attempt=initial; let flight=null;
  function finish(result) {
    attempt=null;
    try { clear(); } catch { /* A stale stored attempt can be safely reconciled on reload. */ }
    return result;
  }
  async function find() {
    const booking=await reconcile(attempt.id);
    return booking ? {outcome:booking.status,booking,replayed:true} : null;
  }
  function submit(payload,review) {
    if (flight) return flight;
    flight=(async()=>{
      const recovering=Boolean(attempt);
      if (!attempt) {
        const candidate={id:uuid(),payload:structuredClone(payload),review:structuredClone(review)};
        persist(candidate); // Do not submit if recovery storage cannot be written.
        attempt=candidate;
      }
      if (recovering) {
        try { const result=await find(); if(result) return finish(result); }
        catch { return {outcome:'uncertain'}; }
      }
      try {
        const result=await create(attempt.payload,attempt.id);
        if (['confirmed','cancelled','unavailable','re_quote'].includes(result?.outcome)) return finish(result);
        return {outcome:result?.outcome==='retryable_busy'?'retryable_busy':'uncertain'};
      } catch(error) {
        try { const result=await find(); if(result) return finish(result); }
        catch { return {outcome:'uncertain'}; }
        if (error.definitive) return finish({outcome:'invalid'});
        return {outcome:'uncertain'};
      }
    })().finally(()=>{flight=null;});
    return flight;
  }
  return { submit,get pending(){return attempt;},get busy(){return Boolean(flight);} };
}
