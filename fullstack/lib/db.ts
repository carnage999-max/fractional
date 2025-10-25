import { Asset, Holding, ActivityEvent } from "./types";
const db = { assets: [] as Asset[], holdings: new Map<string, Holding[]>(), activity: new Map<string, ActivityEvent[]>() };
function seed(){
  if(db.assets.length) return;
  const now = () => new Date().toISOString();
  db.assets.push(
    { id:"asset_001", name:"Community Solar Array", description:"Own fractions of a local solar mini-grid.", image:"/logo.svg", category:"RWA",
      nftTokenId:"0.0.1001", fractionTokenId:"0.0.2001", distributor:"0xDistributor1", pricePerShare:"0.50", sharesTotal:10000, sharesAvailable:8200, apr:"12", creator:"0.0.issuer", createdAt:now() },
    { id:"asset_002", name:"Indie Music Royalties", description:"Back a rising artist and share streaming revenue.", image:"/logo.svg", category:"RWA",
      nftTokenId:"0.0.1002", fractionTokenId:"0.0.2002", distributor:"0xDistributor2", pricePerShare:"1.00", sharesTotal:5000, sharesAvailable:4300, apr:"8", creator:"0.0.issuer", createdAt:now() },
    { id:"asset_003", name:"Gaming Skins Vault", description:"Tradable game cosmetics with revenue share on sales.", image:"/logo.svg", category:"GAMING",
      nftTokenId:"0.0.1003", fractionTokenId:"0.0.2003", distributor:"0xDistributor3", pricePerShare:"0.25", sharesTotal:20000, sharesAvailable:20000, creator:"0.0.issuer", createdAt:now() }
  );
  db.activity.set("asset_001", [{type:"MINT_NFT",txLink:"#",at:now()},{type:"CREATE_FT",txLink:"#",at:now()}]);
  db.activity.set("asset_002", [{type:"MINT_NFT",txLink:"#",at:now()},{type:"CREATE_FT",txLink:"#",at:now()}]);
  db.activity.set("asset_003", [{type:"MINT_NFT",txLink:"#",at:now()},{type:"CREATE_FT",txLink:"#",at:now()}]);
}
seed();
export default db;
