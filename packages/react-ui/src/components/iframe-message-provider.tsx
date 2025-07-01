import React, { useEffect, useRef } from 'react'

type IframeMessageProviderProps = {
  children: React.ReactNode;
};


export default function IframeMessageProvider({ children }:IframeMessageProviderProps) {    
    const WF_IFRAME_CHANNEL_ID = "newWorkflowBuilderIframeChannel"
    const appizapURL = import.meta.env.VITE_APPIZAP_FRONTEND_URL
    const appizapOrigin = new URL(appizapURL || "").origin
    const versionRef = useRef(-1)
    
    function handler(event: MessageEvent) {
        if (event?.data?.id && event.data.id == WF_IFRAME_CHANNEL_ID) {
          console.log(event, "in child")
          if (!event.data.version || !event.data.User) {
            console.error("missing version or User in event data", event.data)
            return
          }
          const AckData = { message: "ACK", id: WF_IFRAME_CHANNEL_ID, version: event.data.version }
          if (versionRef.current != event.data.version) {
            console.log("new virsion recvd", event.data.version)
            if (!window.top) {
              console.error("parent window not found or loaded")
              return
            }
            console.log("User data", event.data.User)
            window.top.postMessage(AckData, appizapOrigin)
            versionRef.current = event.data.version
          } else {
            console.log("old version sending ack", event.data.version)
            window.top?.postMessage(AckData, appizapOrigin)
          }
        }
      }
    useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener(
        "message",
        handler,
      )
      return () => {
        window.removeEventListener("message", handler)
      }
    }
  }, [])
  
    return (
    <>
    {children}
    </>
  )
}
