import { expect, test } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import fixture from '../research/sha256-pair.json';
import { parsePaperHex, sha256CompressionChain, STANDARD_IV } from '../research/sha256-compression';
const a=parsePaperHex(fixture.messageAHex),b=parsePaperHex(fixture.messageBHex);
const hx=(v:Uint8Array)=>Array.from(v,x=>x.toString(16).padStart(2,'0')).join('');
function pad(message:Uint8Array){
 const padded=new Uint8Array(Math.ceil((message.length+9)/64)*64);padded.set(message);padded[message.length]=0x80;
 new DataView(padded.buffer).setBigUint64(padded.length-8,BigInt(message.length)*8n,false);return padded;
}
test('Table 2 uses distinct two-block messages and matches its independently verified value',()=>{
 expect(a).toHaveLength(128);expect(b).toHaveLength(128);expect(a).not.toEqual(b);expect(a.slice(0,64)).toEqual(b.slice(0,64));
 expect(sha256CompressionChain(a,36)).toBe(fixture.expectedCompressionHex);
 expect(sha256CompressionChain(b,36)).toBe(fixture.expectedCompressionHex);
 expect(hx(sha256(a))).toBe(fixture.fullSha256A);expect(hx(sha256(b))).toBe(fixture.fullSha256B);
 expect(fixture.fullSha256A).not.toBe(fixture.fullSha256B);
});
for(const n of [0,1,55,56,63,64,65,128])test(`64-step engine matches independent noble SHA256 with standard padding at ${n} bytes`,()=>{
 const message=Uint8Array.from({length:n},(_,i)=>i%256);
 expect(sha256CompressionChain(pad(message),64)).toBe(hx(sha256(message)));
});
test('every one-bit mutation of B breaks this supplied compression collision',()=>{
 const expected=sha256CompressionChain(a,36);
 for(let bit=0;bit<1024;bit++){const altered=b.slice();altered[bit>>>3]^=1<<(bit%8);expect(sha256CompressionChain(altered,36),`bit ${bit}`).not.toBe(expected);}
});
test('wrong round counts, IV and padding conventions cannot be reported as the supplied result',()=>{
 for(const steps of [35,37,64])expect(sha256CompressionChain(a,steps)).not.toBe(fixture.expectedCompressionHex);
 const iv=[...STANDARD_IV];iv[0]^=1;expect(sha256CompressionChain(a,36,iv)).not.toBe(fixture.expectedCompressionHex);
 expect(sha256CompressionChain(pad(a),36)).not.toBe(fixture.expectedCompressionHex);
 expect(()=>sha256CompressionChain(a.slice(0,127),36)).toThrow(/complete 64-byte blocks/);
 for(const steps of [0,36.5,65])expect(()=>sha256CompressionChain(a,steps)).toThrow();
 expect(()=>parsePaperHex('aa0')).toThrow();expect(()=>sha256CompressionChain(a,36,[])).toThrow();
});
