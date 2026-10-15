export function ViceCityIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>Rockstar Games 于 2002 年发行 Grand Theft Auto: Vice City。官方资料将它描述为发生在 1980 年代风格大城市中的非线性犯罪故事，开发商为 Rockstar North。</p>
        <p>当前浏览器版在进入游戏前使用独立启动器。实测资源下载可以完成，点击开始画面可以响应键盘输入，随后能够进入 Vice City 主菜单。</p>
      </div>

      <h3 className="mt-8 text-xl font-semibold">操作秘籍</h3>
      <ul className="mt-4 space-y-3 text-sm leading-7 text-base-content/80 sm:text-base">
        <li><strong>恢复生命：</strong>2002 Windows PC 版游玩过程中用键盘输入 <code className="font-semibold text-base-content">ASPIRINE</code>。</li>
        <li><strong>恢复护甲：</strong>2002 Windows PC 版游玩过程中用键盘输入 <code className="font-semibold text-base-content">PRECIOUSPROTECTION</code>。</li>
        <li><strong>清除通缉等级：</strong>2002 Windows PC 版游玩过程中用键盘输入 <code className="font-semibold text-base-content">LEAVEMEALONE</code>。</li>
        <li><strong>生成 Rhino 坦克：</strong>2002 Windows PC 版游玩过程中用键盘输入 <code className="font-semibold text-base-content">PANZER</code>。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="鼠标">点击立即畅玩、开始、Play Game 或其他可见启动器选项</Control>
        <Control keys="Enter">推进点击开始画面，并跳过开场进入主菜单</Control>
        <Control keys="启动器屏幕按钮">打开 Save Manager、Mod Manager，或在启动前调整 FPS 限制</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>首次进入先等待资源下载完成，出现点击开始画面后再继续操作。</li>
        <li>启动器提示：低性能设备发热或任务受物理效果影响时，可以把 FPS 限制调为 30。</li>
        <li>看到点击开始提示后按 Enter，可以继续开场并进入主菜单。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">已知限制</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>首次启动需要下载较大的资源包，所需时间取决于当前网络环境。</li>
        <li>当前浏览器版的启动器和游戏菜单显示为英文。</li>
      </ul>
    </section>
  )
}

function Control({ children, keys }: { children: string; keys: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-4 py-3">
      <dt className="font-semibold text-base-content">{keys}</dt>
      <dd className="mt-1 text-base-content/70">{children}</dd>
    </div>
  )
}
