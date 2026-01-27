
//graph_on
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor">
  <!-- узлы -->
  <circle cx="6" cy="12" r="3"/>
  <circle cx="17" cy="7" r="3"/>
  <circle cx="17" cy="17" r="3"/>

  <!-- рёбра (тоньше: stroke-width=1.33) -->
  <line x1="6" y1="12" x2="17" y2="7" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/>
  <line x1="6" y1="12" x2="17" y2="17" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/>
</svg>

//graph_off
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor">
  <circle cx="6" cy="12" r="3"/>
  <circle cx="17" cy="7" r="3"/>
  <circle cx="17" cy="17" r="3"/>
</svg>

//exit_free_mode
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="none"
     stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">

  <!-- дверной проём -->
  <line x1="6"  y1="4" x2="18" y2="4" />   <!-- верхняя перекладина -->
  <line x1="6"  y1="4" x2="6"  y2="20" />  <!-- левая стойка -->
  <line x1="6"  y1="20" x2="18" y2="20" /> <!-- низ -->

  <!-- правая короткая стойка (новая) -->
  <line x1="18" y1="4" x2="18" y2="6" />

  <!-- полотно двери -->
  <path d="M11 4 L18 6 L18 20 L11 18 Z" />

  <!-- ручка двери -->
  <circle cx="16" cy="12.5" r="0.7" fill="currentColor" stroke="none" />

</svg>


//sector_info_off
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="none" stroke="currentColor" stroke-width="1.5">
  <circle cx="12" cy="12" r="8" />
</svg>

//sector_info_on
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="none" stroke="currentColor" stroke-width="1.5">
  <circle cx="12" cy="12" r="8" />
  <text x="12" y="13.6"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="11"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="currentColor">
    T
  </text>
</svg>

//sector_info_CN
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="none" stroke="currentColor" stroke-width="1.5">
  <circle cx="12" cy="12" r="8" />
  <text x="12" y="12.32"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="10.78"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="currentColor">
    文
  </text>
</svg>

//bubble_pop_off
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor">
  <circle cx="12" cy="12" r="6" />
</svg>

//bubble_pop_on
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor">

  <!-- остаток центра -->
  <path d="M11 10 L13 11 L12 13 L10 12 Z" />

  <!-- осколки -->
  <path d="M7.5 11 L9 12.5 L7.2 13.4 L6.5 12 Z" />
  <path d="M15.5 11 L17.2 12 L16 13.5 L14.5 12.2 Z" />

  <path d="M10.2 7.5 L12 8.2 L11.2 9.8 L9.7 9 Z" />
  <path d="M13.8 7.8 L15.2 9 L14 10 L12.8 8.7 Z" />

  <path d="M10.5 15 L12.2 15.5 L11.5 17 L9.8 16.2 Z" />
  <path d="M14 15.5 L15.8 16.2 L14.8 17.5 L13.2 16.7 Z" />

  <!-- мелкие куски -->
  <path d="M6.5 9.8 L7.4 10.2 L7 11 L6 10.6 Z" />
  <path d="M17 9.5 L18 10 L17.5 11 L16.5 10.4 Z" />
  <path d="M17.5 14 L18.3 14.6 L17.7 15.5 L16.8 15 Z" />
  <path d="M7 15 L7.8 15.6 L7.2 16.3 L6.3 15.7 Z" />

</svg>


//undo_bubble_pop
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor">

  <!-- остаток центра -->
  <path d="M11 10 L13 11 L12 13 L10 12 Z" />

  <!-- осколки -->
  <path d="M7.5 11 L9 12.5 L7.2 13.4 L6.5 12 Z" />
  <path d="M15.5 11 L17.2 12 L16 13.5 L14.5 12.2 Z" />

  <path d="M10.2 7.5 L12 8.2 L11.2 9.8 L9.7 9 Z" />
  <path d="M13.8 7.8 L15.2 9 L14 10 L12.8 8.7 Z" />

  <path d="M10.5 15 L12.2 15.5 L11.5 17 L9.8 16.2 Z" />
  <path d="M14 15.5 L15.8 16.2 L14.8 17.5 L13.2 16.7 Z" />

  <!-- мелкие куски -->
  <path d="M6.5 9.8 L7.4 10.2 L7 11 L6 10.6 Z" />
  <path d="M17 9.5 L18 10 L17.5 11 L16.5 10.4 Z" />
  <path d="M17.5 14 L18.3 14.6 L17.7 15.5 L16.8 15 Z" />
  <path d="M7 15 L7.8 15.6 L7.2 16.3 L6.3 15.7 Z" />

  <!-- крест поверх (перечёркивание) -->
  <line x1="6" y1="6" x2="18" y2="18"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <line x1="18" y1="6" x2="6" y2="18"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
</svg>

//show_metrics_off
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <line x1="4.8" y1="12" x2="19.2" y2="12" />
</svg>

//show_metrics_on
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">

  <line x1="4.8" y1="12" x2="19.2" y2="12" />

  <text x="12" y="9"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="5.5"
        font-family="system-ui, sans-serif"
        fill="currentColor">T</text>

</svg>

//show_metrics_on_CN
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">

  <line x1="4.8" y1="12" x2="19.2" y2="12" />

  <text x="12" y="9"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="5.39"
        font-family="system-ui, sans-serif"
        fill="currentColor">文</text>

</svg>

//delete_edge_off
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">

  <!-- левый шар -->
  <circle cx="5.3" cy="12" r="2.5"/>

  <!-- правый шар -->
  <circle cx="18.7" cy="12" r="2.5"/>

  <!-- целая связь -->
  <line x1="7.8" y1="12" x2="16.2" y2="12" />

</svg>

//delete_edge_on
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24" fill="currentColor"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">

  <!-- левый шар -->
  <circle cx="5.3" cy="12" r="2.5"/>

  <!-- правый шар -->
  <circle cx="18.7" cy="12" r="2.5"/>

  <!-- укороченные разорванные сегменты -->
  <line x1="7.8" y1="12" x2="10.6" y2="12" />
  <line x1="13.4" y1="12" x2="16.2" y2="12" />

</svg>

//delete_all_edges
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="currentColor"
     stroke="currentColor" stroke-width="1.33" stroke-linecap="round">

  <!-- узлы -->
  <circle cx="6"   cy="12" r="3"/>
  <circle cx="19.2" cy="7"  r="3"/>
  <circle cx="19.2" cy="17" r="3"/>

  <!-- короткие отрезки от центрального узла -->
  <line x1="7.8" y1="11" x2="10"   y2="10" />
  <line x1="7.8" y1="13" x2="10"   y2="14" />

  <!-- короткие отрезки от верхнего правого узла -->
  <line x1="17.3" y1="8"  x2="15.5" y2="9"  />

  <!-- короткие отрезки от нижнего правого узла -->
  <line x1="17.3" y1="16" x2="15.5" y2="15" />

</svg>


//save_snapshot
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="none" stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">

  <!-- корпус дискеты с «срезанным» верхним правым углом -->
  <path d="M6 4h9l3 3v13H6z" />

  <!-- область этикетки -->
  <rect x="7.5" y="5.5" width="7" height="4" rx="0.7" />

  <!-- нижняя зона (металлическая часть / слот) -->
  <rect x="8" y="13" width="8" height="5" rx="0.7" />

  <!-- разделительная линия внизу -->
  <line x1="8" y1="13" x2="16" y2="13" />
</svg>

//load_snapshot
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="none" stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">

  <!-- корпус дискеты -->
  <path d="M6 4h9l3 3v13H6z" />

  <!-- стрелка вверх -->
  <line x1="12" y1="16" x2="12" y2="9" />
  <polyline points="9.5,11.5 12,9 14.5,11.5" />

</svg>

//Theme_switch
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="currentColor"
     stroke="currentColor" stroke-width="0.75"
     stroke-linecap="round" stroke-linejoin="round">

  <!-- круг (сдвинут на 5% левее) -->
  <circle cx="5.8" cy="12" r="3"/>

  <!-- квадрат (остаётся разнесённым на 25%) -->
  <rect x="15.8" y="9" width="6" height="6" rx="0.5"/>

  <!-- двунаправленная стрелка — теперь самостоятельная и центрирована -->
  <line x1="10.3" y1="12" x2="14.3" y2="12"/>
  <polyline points="11.3,11 10.3,12 11.3,13" />
  <polyline points="13.3,11 14.3,12 13.3,13" />

</svg>

