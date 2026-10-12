import fixture from './sha256-pair.json';
import { parsePaperHex, sha256CompressionChain } from './sha256-compression';
import { webcryptoDigest } from '../hashing/webcrypto';
import { bytesToHex } from '../util/hex';

export function mountSha256Pair(host:HTMLElement): void {
 host.innerHTML = `<h3>Verify the paper’s actual 36-step pair</h3>
 <p><a href="https://eprint.iacr.org/2026/1120" target="_blank" rel="noopener noreferrer">Li et al., preprint revised 9 September 2026, Table 2 (p. 14)</a>. These are two distinct 128-byte messages with the same first block. The values below are recomputed from those bytes.</p>
 <p><strong>Exact convention:</strong> big-endian words, the standard SHA-256 IV, steps 0–35 per block, feed-forward after each block, two supplied blocks. No extra padding is added for the paper’s reported value. The full WebCrypto SHA-256 comparison applies normal message padding. This is different from the appendix’s attacker-selected-IV semi-free-start examples.</p>
 <label for="sha2-research-steps">Compression convention</label>
 <select id="sha2-research-steps"><option value="36">36 steps — Table 2 convention</option><option value="35">35 steps — wrong-round negative control</option><option value="64">64 steps — compression-only negative control</option></select>
 <label class="sha2-mutation"><input type="checkbox" id="sha2-research-mutate"> Flip one bit in message B (negative control)</label>
 <p id="sha2-research-verdict" role="status" aria-live="polite"></p>
 <dl class="sha2-research-values"><dt>Compression chain A</dt><dd id="sha2-chain-a"></dd><dt>Compression chain B</dt><dd id="sha2-chain-b"></dd><dt>Full SHA-256(A)</dt><dd id="sha2-full-a"></dd><dt>Full SHA-256(B)</dt><dd id="sha2-full-b"></dd></dl>
 <details><summary>Message bytes and retrieval provenance</summary><p>Message A (hex)</p><pre id="sha2-message-a"></pre><p>Message B (hex, including the selected mutation)</p><pre id="sha2-message-b"></pre><p>PDF retrieved from the ePrint mirror; its SHA-256 fingerprint is <code>${fixture.sourcePdfSha256}</code>. The original ePrint metadata identifies the preprint and revision. This verifies the supplied pair, not the work of finding it or the paper’s complexity analysis.</p></details>
 <p>This research verifier is separate from the existing full-round pair selector and proof export. A reduced-round match does not make full SHA-256 broken. The 64-step compression control also omits padding, so its displayed chaining value is not called the standard message digest.</p>`;
 const a=parsePaperHex(fixture.messageAHex),originalB=parsePaperHex(fixture.messageBHex);
 const select=host.querySelector<HTMLSelectElement>('#sha2-research-steps')!;
 const mutate=host.querySelector<HTMLInputElement>('#sha2-research-mutate')!;
 let token=0;
 const update=async()=>{
  const current=++token;
  const set=(id:string,value:string)=>{host.querySelector('#'+id)!.textContent=value;};
  set('sha2-research-verdict','Verifying the supplied messages…');set('sha2-full-a','Computing…');set('sha2-full-b','Computing…');
  try{
   const b=originalB.slice();if(mutate.checked)b[127]^=1;
   const steps=Number(select.value),ha=sha256CompressionChain(a,steps),hb=sha256CompressionChain(b,steps);
   const [fa,fb]=await Promise.all([webcryptoDigest('SHA-256',a),webcryptoDigest('SHA-256',b)]);
   if(current!==token)return;
   set('sha2-chain-a',ha);set('sha2-chain-b',hb);set('sha2-full-a',bytesToHex(fa));set('sha2-full-b',bytesToHex(fb));
   set('sha2-message-a',fixture.messageAHex);set('sha2-message-b',bytesToHex(b));
   const expected=steps===36&&!mutate.checked;
   const verified=expected&&ha===hb&&ha===fixture.expectedCompressionHex&&bytesToHex(fa)!==bytesToHex(fb);
   set('sha2-research-verdict',verified?'Verified: the published 36-step compression values match; full SHA-256 digests differ.':ha!==hb?'Negative control: compression values differ. This selection does not reproduce the paper’s pair.':'Verification failed: this is not the published Table 2 result.');
  }catch(error){if(current===token)set('sha2-research-verdict',`Verification error: ${error instanceof Error?error.message:String(error)}`);}
 };
 for(const input of [select,mutate])input.addEventListener('change',()=>{void update();});
 void update();
}
