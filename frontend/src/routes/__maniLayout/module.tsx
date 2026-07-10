import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, Brain, Database } from "lucide-react"

const moduleItems = [
  {
    title: "AI-Powered Student Course Allocation System",
    description:
      "Merit & reservation-based automatic course allocation with an AI assistant for reporting and analytics",
    body: "Manage student applications, courses, and run the allocation engine that balances marks, category reservations, and preferences — all with an AI-powered assistant for natural language analytics.",
    icon: Brain,
    to: "/sca/student-management",
  },
  {
    title: "AI SQL Assistant - Sales Analytics",
    description:
      "Query ecommerce sales using natural language",
    body: "Use the provided `ecommerce_sales_data.xlsx` dataset, auto-detect the schema, create the sales table, and ask revenue, customer, duplicate, missing-value, and summary questions in plain English.",
    icon: Database,
    to: "/asa/home",
  },
] as const

export const Route = createFileRoute("/__maniLayout/module")({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [showAlert, setShowAlert] = React.useState(false)

  React.useEffect(() => {
    sessionStorage.removeItem("selectedModule")
    if (sessionStorage.getItem("moduleAlert")) {
      setShowAlert(true)
      sessionStorage.removeItem("moduleAlert")
    }
  }, [])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6">
      {showAlert && (
        <Alert variant="destructive" className="w-full max-w-4xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Module Required</AlertTitle>
          <AlertDescription>
            Please select a module first before accessing that section.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        {moduleItems.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => {
              sessionStorage.setItem("selectedModule", item.to)
              navigate({ to: item.to })
            }}
            className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Open ${item.title}`}
          >
            <Card className="h-full border-slate-200 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}
