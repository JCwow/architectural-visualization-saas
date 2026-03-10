import { type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("api/puter/*", "./routes/api.puter.proxy.ts"),
    route("visualize/:id", "./routes/visualize.$id.tsx"),
    route("share/:id", "./routes/share.$id.tsx"),
] satisfies RouteConfig;
