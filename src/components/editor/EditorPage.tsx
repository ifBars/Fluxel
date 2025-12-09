import Workbench from "../workbench/Workbench";

export default function EditorPage() {
    return (
        <div className="h-full w-full bg-background text-foreground flex flex-col overflow-hidden">
            <Workbench />
        </div>
    );
}
