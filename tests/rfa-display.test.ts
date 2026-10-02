// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaLink } from "../packages/react/src/rfa-display";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
it("supports host navigation while preserving modified link clicks",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const select=vi.fn();
 try{
 await act(async()=>root.render(createElement(RfaLink,{href:"/rfas/example",onSelect:select,children:"Knee rehabilitation"})));
 const link=container.querySelector("a")!;
 const normal=new MouseEvent("click",{bubbles:true,cancelable:true});await act(async()=>link.dispatchEvent(normal));expect(normal.defaultPrevented).toBe(true);expect(select).toHaveBeenCalledTimes(1);
 const modified=new MouseEvent("click",{bubbles:true,cancelable:true,ctrlKey:true});await act(async()=>link.dispatchEvent(modified));expect(modified.defaultPrevented).toBe(false);expect(select).toHaveBeenCalledTimes(1);expect(link.getAttribute("href")).toBe("/rfas/example");
 }finally{await act(async()=>root.unmount());container.remove();}
});
