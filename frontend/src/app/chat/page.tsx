import ChatInterface from "@/components/Chat/ChatInterface";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="p-6 border-b border-dark-700">
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="text-slate-400 mt-1">Chat with Claude to manage your media library</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
