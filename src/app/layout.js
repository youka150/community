import "./globals.css";
import { ThemeProvider } from "@/lib/ThemeContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { AuthProvider } from "@/context/AuthContext";
import { ConfigProvider } from "antd";
// 配置 Antd 的本地化
import zhCN from "antd/locale/zh_CN";

export const metadata = {
  title: "企业主导型创意社区用户行为特征建模与创意洞察系统",
  description: "企业主导型创意社区用户行为特征建模与创意洞察系统",
  // 标签页图标
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <ConfigProvider 
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#7b35ff',
              colorInfo: '#8b4efd',
              colorSuccess: '#10b981',
              colorWarning: '#F59E0B',
              colorError: '#ef4444',
              borderRadius: 8,
              fontFamily: '"Fira Sans", ui-sans-serif, system-ui, sans-serif'
            }
          }}
        >
          <AuthProvider>
            <AnalysisProvider>
              <ThemeProvider>
                {children}
              </ThemeProvider>
            </AnalysisProvider>
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
