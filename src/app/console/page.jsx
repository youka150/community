import { redirect } from 'next/navigation';

/**
 * /console 默认页 → 重定向到华为数据大屏
 */
export default function ConsolePage() {
  redirect('/console/huawei');
}
