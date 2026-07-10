import {
  BarChart3,
  BookOpenCheck,
  Bot,
  Database,
  GraduationCap,
  Grid2X2,
  Table2,
  Users,
  WandSparkles,
} from "lucide-react"

type NavigationItem = {
  title: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

type NavigationSection = {
  label: string
  items: readonly NavigationItem[]
}

type NavigationFooter = {
  avatarSeed: string
  title: string
  subtitle: string
  description: string
}

export type NavigationModel = {
  brandTitle: string
  brandSubtitle: string
  brandTo: string
  sections: readonly NavigationSection[]
  footer: NavigationFooter
}

const moduleNavigation: NavigationModel = {
  brandTitle: "Modules",
  brandSubtitle: "Assessment modules",
  brandTo: "/module",
  sections: [
    {
      label: "Modules",
      items: [{ title: "Module Selection", to: "/module", icon: Grid2X2 }],
    },
  ],
  footer: {
    avatarSeed: "Assessment",
    title: "Assessment Modules",
    subtitle: "Module selector",
    description:
      "Choose Task 1 for the student allocation platform or Task 2 for the AI SQL assistant experience.",
  },
}

const scaNavigation: NavigationModel = {
  brandTitle: "SCA",
  brandSubtitle: "Student allocation system",
  brandTo: "/sca/home",
  sections: [
    {
      label: "SCA",
      items: [
        {
          title: "Dashboard",
          to: "/sca/home",
          icon: BarChart3,
        },
        {
          title: "Student Management",
          to: "/sca/student-management",
          icon: Users,
        },
        {
          title: "Course Management",
          to: "/sca/course-management",
          icon: BookOpenCheck,
        },
        {
          title: "Allocation Processing",
          to: "/sca/allocation-processing",
          icon: GraduationCap,
        },
        {
          title: "AI Assistant",
          to: "/sca/ai-assistant",
          icon: Bot,
        },
      ],
    },
  ],
  footer: {
    avatarSeed: "SCA",
    title: "SCA",
    subtitle: "Student allocation system",
    description:
      "Includes student management, course management, allocation processing, and AI-assisted reporting based on merit and reservation rules.",
  },
}

const asaNavigation: NavigationModel = {
  brandTitle: "ASA",
  brandSubtitle: "AI SQL assistant",
  brandTo: "/asa/home",
  sections: [
    {
      label: "ASA",
      items: [
        {
          title: "Dashboard",
          to: "/asa/home",
          icon: BarChart3,
        },
        {
          title: "Dataset Upload",
          to: "/asa/dataset-upload",
          icon: Database,
        },
        {
          title: "Dynamic Tables",
          to: "/asa/dynamic-table-creation",
          icon: Table2,
        },
        {
          title: "AI SQL Assistant",
          to: "/asa/sql-assistant",
          icon: WandSparkles,
        },
      ],
    },
  ],
  footer: {
    avatarSeed: "ASA",
    title: "ASA",
    subtitle: "Sales analytics",
    description:
      "Includes the ecommerce sales dataset upload, schema detection, dynamic table creation, dashboard analytics, and validated AI-powered SQL querying.",
  },
}

export function getNavigationModel(pathname: string): NavigationModel {
  if (pathname.startsWith("/sca")) {
    return scaNavigation
  }

  if (pathname.startsWith("/asa")) {
    return asaNavigation
  }

  if (pathname.startsWith("/module")) {
    return moduleNavigation
  }

  return moduleNavigation
}

export function getPathTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") {
    return "Dashboard"
  }

  const matchingNavigation = getNavigationModel(pathname)
  const matchingItem = matchingNavigation.sections
    .flatMap((section) => section.items)
    .find(
      (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
    )

  if (matchingItem) {
    return matchingItem.title
  }

  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard"
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
