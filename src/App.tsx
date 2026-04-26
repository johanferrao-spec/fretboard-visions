import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Courses from "./pages/Courses.tsx";
import CourseDetail from "./pages/CourseDetail.tsx";
import CourseCreator from "./pages/CourseCreator.tsx";
import CoursePlayer from "./pages/CoursePlayer.tsx";
import { SampleLibraryProvider } from "@/hooks/SampleLibraryContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SampleLibraryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CourseDetail />} />
          <Route path="/courses/:courseId/lessons/:tabId/edit" element={<CourseCreator />} />
          <Route path="/courses/:courseId/lessons/:tabId" element={<CoursePlayer />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </SampleLibraryProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
