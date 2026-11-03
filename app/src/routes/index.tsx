import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/")({
head:()=>({links:[{rel:"canonical",href:"https://memo-american-superblock.higgsfield.app/"}]}),
component:()=> <main style={{position:"fixed",inset:0,background:"white"}}><iframe title="MEMO Studio — American Superblock interactive model" src="/superblock.html" style={{width:"100%",height:"100%",border:0,display:"block"}} allowFullScreen /><noscript>Explore the 660 × 660 ft American Superblock by MEMO Studio. Enable JavaScript to view the interactive model and export IFC.</noscript></main>
});
