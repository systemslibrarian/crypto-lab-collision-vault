/** FIPS 180-4 §6.2 compression with an explicit research step count.
 * This API consumes whole blocks without adding SHA-256 message padding.
 * It is not the normal hashing API or a production cryptographic provider.
 */
export const STANDARD_IV = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19] as const;
const K = [
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
const rotr = (word:number,n:number) => (word >>> n) | (word << (32-n));
export function parsePaperHex(hex:string): Uint8Array {
 if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('Expected complete hexadecimal bytes.');
 return Uint8Array.from(hex.match(/../g)!,pair=>parseInt(pair,16));
}
export function sha256CompressionChain(bytes:Uint8Array,steps:number,iv:readonly number[]=STANDARD_IV): string {
 if (!bytes.length || bytes.length%64!==0) throw new Error('Supply complete 64-byte blocks; padding is not added.');
 if (!Number.isInteger(steps)||steps<1||steps>64) throw new Error('Step count must be an integer from 1 to 64.');
 if(iv.length!==8||iv.some(w=>!Number.isInteger(w)||w<0||w>0xffffffff))throw new Error('The IV must contain eight unsigned 32-bit words.');
 const state=[...iv];
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let offset=0;offset<bytes.length;offset+=64){
  const w=new Uint32Array(64);
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);
  for(let i=16;i<steps;i++){
   const x=w[i-15],y=w[i-2];
   w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0;
  }
  let [a,b,c,d,e,f,g,h]=state;
  for(let i=0;i<steps;i++){
   const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
   const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   [a,b,c,d,e,f,g,h]=[(t1+t2)>>>0,a,b,c,(d+t1)>>>0,e,f,g];
  }
  for(const [i,value] of [a,b,c,d,e,f,g,h].entries())state[i]=(state[i]+value)>>>0;
 }
 return state.map(w=>w.toString(16).padStart(8,'0')).join('');
}
