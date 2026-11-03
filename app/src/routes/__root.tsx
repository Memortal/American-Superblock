import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {Outlet,createRootRouteWithContext,HeadContent,Scripts} from "@tanstack/react-router";
import {useEffect,type ReactNode} from "react";
import meta from "../app-meta.json";
import appCss from "../styles.css?url";
declare const __HF_DESIGN_INSPECTOR__:boolean;
export const Route=createRootRouteWithContext<{queryClient:QueryClient}>()({
head:()=>({meta:[{charSet:"utf-8"},{name:"viewport",content:"width=device-width, initial-scale=1"},{title:meta.og_title},{name:"description",content:meta.og_description},{name:"author",content:"MEMO Studio"},{property:"og:title",content:meta.og_title},{property:"og:description",content:meta.og_description},{property:"og:image",content:meta.og_image_url},{name:"twitter:card",content:"summary_large_image"}],links:[{rel:"stylesheet",href:appCss},{rel:"icon",href:meta.favicon_url}]}),
shellComponent:({children}:{children:ReactNode})=><html lang="en" style={{colorScheme:"light"}}><head><HeadContent/></head><body style={{margin:0,background:"white"}}>{children}<Scripts/></body></html>,
component:Root,
notFoundComponent:()=> <main><h1>Page not found</h1><a href="/">Open the Superblock</a></main>
});
function Root(){const {queryClient}=Route.useRouteContext();useEffect(()=>{if(__HF_DESIGN_INSPECTOR__)void import("../module/design-inspector/runtime").then(m=>m.installHiggsfieldDesignInspector());},[]);return <QueryClientProvider client={queryClient}><Outlet/></QueryClientProvider>;}
