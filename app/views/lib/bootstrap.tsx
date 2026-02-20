import { Alert, Popover, Tooltip } from "bootstrap"
import { type ComponentChild, render } from "preact"
import { useEffect, useRef } from "preact/hooks"

export const BPopover = ({
  content,
  trigger,
  children,
}: {
  content: () => ComponentChild
  trigger?: Popover.Options["trigger"] | undefined
  children: ComponentChild
}) => {
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const contentNode = document.createElement("div")
    render(content(), contentNode)

    const options: Partial<Popover.Options> = {
      html: true,
      container: "body",
      content: () => contentNode,
    }
    if (trigger !== undefined) options.trigger = trigger

    const popover = new Popover(wrapperRef.current!, options)

    return () => {
      popover.dispose()
      render(null, contentNode)
    }
  }, [content, trigger])

  return <span ref={wrapperRef}>{children}</span>
}

export const BTooltip = ({
  title,
  placement,
  children,
}: {
  title: string | undefined
  placement?: Tooltip.Options["placement"] | undefined
  children: ComponentChild
}) => {
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (title === undefined) return

    const options: Partial<Tooltip.Options> = { title }
    if (placement !== undefined) options.placement = placement

    const tooltip = new Tooltip(wrapperRef.current!, options)
    return () => tooltip.dispose()
  }, [title, placement])

  return <span ref={wrapperRef}>{children}</span>
}

export const configureBootstrapTooltips = (root: ParentNode) => {
  for (const element of root.querySelectorAll("[data-bs-toggle=tooltip]")) {
    Tooltip.getOrCreateInstance(element)
  }
}

export const configureBootstrapAlerts = (root: ParentNode) => {
  for (const element of root.querySelectorAll(".alert")) {
    Alert.getOrCreateInstance(element)
  }
}

export const configureBootstrapPopovers = (root: ParentNode) => {
  for (const element of root.querySelectorAll("[data-bs-toggle=popover]")) {
    Popover.getOrCreateInstance(element)
  }
}

configureBootstrapTooltips(document)
configureBootstrapAlerts(document)
configureBootstrapPopovers(document)
