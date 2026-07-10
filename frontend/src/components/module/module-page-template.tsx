import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ContentSection = {
  title: string
  description?: string
  items: readonly string[]
}

type ModulePageTemplateProps = {
  badge: string
  title: string
  description: string
  highlights: readonly string[]
  sections: readonly ContentSection[]
}

export function ModulePageTemplate({
  badge,
  title,
  description,
  highlights,
  sections,
}: ModulePageTemplateProps) {
  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent">
          <CardHeader className="space-y-5 p-8 md:p-10">
            <span className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
            {badge}
            </span>
            <div className="space-y-3">
              <CardTitle className="max-w-4xl text-3xl leading-tight md:text-4xl">
                {title}
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7 text-muted-foreground">
                {description}
              </CardDescription>
            </div>
          </CardHeader>
        </div>
        <CardContent className="p-8 pt-0 md:p-10 md:pt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4 text-sm font-medium leading-6 text-foreground shadow-sm"
              >
                {highlight}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="h-full border-border/70 shadow-sm">
            <CardHeader className="space-y-2 p-7">
              <CardTitle className="text-xl">{section.title}</CardTitle>
              {section.description ? (
                <CardDescription className="text-sm leading-6">
                  {section.description}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="p-7 pt-0">
              <ul className="space-y-4 text-sm leading-7 text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
