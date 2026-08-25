# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Primary:** Engineering leads, software developers, and product managers working in AI-augmented development environments.
- **Situation & Job:** Collaborating across software teams while orchestrating tasks, DAG dependencies, and project delivery alongside AI coding agents and MCP assistants.

## Product Purpose
TaskFlow bridges human software teams and autonomous AI agents into a single unified task and workflow system. It provides a visual web dashboard for project planning, DAG dependency management, and team analytics while exposing a robust Model Context Protocol (MCP) server that AI agents use to inspect, create, transition, and unblock tasks programmatically. Success means seamless human-agent collaboration with zero friction in task handoffs, crystal-clear dependency tracking, and high team execution velocity.

## Positioning
TaskFlow is an AI-native project execution platform powered by a first-class Model Context Protocol (MCP) server. Unlike traditional issue trackers that treat AI as a bolt-on chatbot, TaskFlow treats AI agents as first-class team contributors with programmatic DAG dependency resolution, automated state machines, and dual stdio/SSE protocol connectivity.

## Operating Context
- **Developer & Agent Workflows:** Developers use AI coding environments connected via MCP to query active tasks, create subtasks, and transition statuses as code is written and reviewed.
- **Web App Dashboard:** Web interface for sprint tracking, project progress visualization, member assignment, calendar feeds, and team metrics.
- **Environment:** Multi-tenant workspace architecture with organization boundaries, role-based access control (Admin, Project Manager, Contributor, Viewer), and real-time state machine transitions.

## Capabilities and Constraints
- **Frontend Stack:** React 19, Vite, Tailwind CSS v4, Redux Toolkit, React Router v7, Recharts, Lucide React, Clerk Auth.
- **Backend / MCP Server:** Node.js/TypeScript MCP Server (`taskflow-mcp`), Prisma ORM with PostgreSQL, DAG task dependencies (`TaskDependency`), State Machine status transitions (`BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `BLOCKED`, `DONE`), iCal calendar feed generator (`calendar.ts`), and in-memory event bus (`eventBus.ts`).
- **Data & Multi-tenancy:** Workspaces, Projects, Tasks, Users, Roles, Notifications, Webhooks, API Key management.

## Brand Commitments
- **Name:** TaskFlow
- **Tone & Voice:** Precise, modern, developer-centric, focused, and efficient.
- **Visual Identity:** Clean dark/light theme foundation, high-density information layout, fast scanability, and refined micro-interactions.

## Evidence on Hand
- Full-stack codebase with frontend dashboard in `frontend/` and MCP server in `taskflow-mcp/`.
- Concrete schema definitions in `taskflow-mcp/prisma/schema.prisma` defining multi-tenancy, RBAC, DAG relationships, and status lifecycles.
- Existing mock workspace data and UI components in `frontend/src/`.

## Product Principles
1. **Agent-Human Parity:** Any workflow manageable via the web UI should be cleanly accessible and automatable by AI agents via MCP tools.
2. **Deterministic State & Clarity:** DAG dependencies and status transitions must be unambiguous, preventing invalid states or circular dependencies.
3. **High-Density Utility:** Prioritize quick scanning, keyboard-friendly interactions, and actionable analytics over ornamental fluff.
4. **Resilient Multi-Tenancy:** Strict workspace and organization scoping across both human web sessions and agent MCP invocations.
