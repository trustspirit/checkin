import { useState, useCallback, RefObject } from 'react'
import { useSetAtom } from 'jotai'
import { addToastAtom } from '../stores/toastStore'
import jsPDF from 'jspdf'
import domToImage from 'dom-to-image-more'

interface UseExportFullPDFOptions {
  filename?: string
  backgroundColor?: string
  orientation?: 'portrait' | 'landscape'
}

interface UseExportFullPDFReturn {
  isExporting: boolean
  exportFullPDF: () => Promise<void>
}

export function useExportFullPDF(
  elementRef: RefObject<HTMLDivElement | null>,
  options: UseExportFullPDFOptions = {}
): UseExportFullPDFReturn {
  const {
    filename = 'export',
    backgroundColor = '#FFFFFF',
    orientation = 'landscape'
  } = options
  const [isExporting, setIsExporting] = useState(false)
  const addToast = useSetAtom(addToastAtom)

  const exportFullPDF = useCallback(async (): Promise<void> => {
    if (!elementRef.current || isExporting) {
      console.log('Export aborted: no element or already exporting')
      return
    }

    setIsExporting(true)
    try {
      const element = elementRef.current
      console.log('Starting PDF export for element:', element)

      // Clone the element for capture
      const clone = element.cloneNode(true) as HTMLElement

      // Create a container for the clone
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '0'
      container.style.top = '0'
      container.style.width = `${element.scrollWidth}px`
      container.style.backgroundColor = backgroundColor
      container.style.zIndex = '-9999'
      container.style.opacity = '0'
      container.style.pointerEvents = 'none'

      // Expand all scrollable areas in the clone
      clone.style.height = 'auto'
      clone.style.maxHeight = 'none'
      clone.style.overflow = 'visible'
      clone.style.width = '100%'

      // Function to inline all computed styles
      const inlineAllStyles = (source: HTMLElement, target: HTMLElement) => {
        const computedStyle = window.getComputedStyle(source)
        
        // List of important CSS properties to inline
        const importantProps = [
          'display', 'position', 'top', 'right', 'bottom', 'left',
          'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
          'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border', 'border-width', 'border-style', 'border-color',
          'border-top', 'border-right', 'border-bottom', 'border-left',
          'border-radius', 'border-top-left-radius', 'border-top-right-radius',
          'border-bottom-left-radius', 'border-bottom-right-radius',
          'background', 'background-color', 'background-image', 'background-size',
          'background-position', 'background-repeat',
          'color', 'font-family', 'font-size', 'font-weight', 'font-style',
          'line-height', 'text-align', 'text-decoration', 'text-transform',
          'letter-spacing', 'white-space', 'word-wrap', 'word-break',
          'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
          'align-content', 'align-self', 'flex-grow', 'flex-shrink', 'flex-basis',
          'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap', 'gap',
          'box-shadow', 'opacity', 'z-index', 'transform', 'transition',
          'overflow', 'overflow-x', 'overflow-y', 'visibility',
          'table-layout', 'border-collapse', 'border-spacing',
          'vertical-align', 'cursor', 'outline', 'box-sizing'
        ]
        
        importantProps.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop)
          if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
            target.style.setProperty(prop, value)
          }
        })
        
        // Handle scrollable areas
        if (
          computedStyle.overflow === 'auto' ||
          computedStyle.overflow === 'scroll' ||
          computedStyle.overflowY === 'auto' ||
          computedStyle.overflowY === 'scroll'
        ) {
          target.style.height = 'auto'
          target.style.maxHeight = 'none'
          target.style.overflow = 'visible'
        }
      }
      
      // Apply inline styles to clone
      inlineAllStyles(element, clone)
      
      // Apply to all children
      const sourceChildren = element.querySelectorAll('*')
      const cloneChildren = clone.querySelectorAll('*')
      
      sourceChildren.forEach((sourceEl, index) => {
        const targetEl = cloneChildren[index] as HTMLElement
        if (targetEl && sourceEl instanceof HTMLElement) {
          inlineAllStyles(sourceEl, targetEl)
        }
      })

      container.appendChild(clone)
      document.body.appendChild(container)

      // Wait for render
      await new Promise((resolve) => setTimeout(resolve, 300))

      const width = clone.scrollWidth
      const height = clone.scrollHeight
      console.log('Clone dimensions:', width, 'x', height)

      // Use dom-to-image-more to capture
      const dataUrl = await domToImage.toPng(clone, {
        width,
        height,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        },
        bgcolor: backgroundColor
      })

      // Remove the container
      document.body.removeChild(container)

      console.log('Image captured, data length:', dataUrl.length)

      // Create image to get dimensions
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = dataUrl
      })

      // PDF dimensions based on orientation
      const pdfWidth = orientation === 'landscape' ? 297 : 210
      const pdfHeight = orientation === 'landscape' ? 210 : 297
      const margin = 10

      // Calculate dimensions to fit width
      const contentWidth = pdfWidth - margin * 2
      const imgAspectRatio = img.height / img.width
      const contentHeight = contentWidth * imgAspectRatio

      // Determine if we need multiple pages
      const maxHeightPerPage = pdfHeight - margin * 2
      const totalPages = Math.ceil(contentHeight / maxHeightPerPage)

      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4'
      })

      if (totalPages === 1) {
        pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, contentHeight)
      } else {
        // Multi-page
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not get canvas context')

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const sourceHeightPerPage = img.height / totalPages

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage()

          const pageCanvas = document.createElement('canvas')
          const pageCtx = pageCanvas.getContext('2d')
          if (!pageCtx) throw new Error('Could not get page canvas context')

          pageCanvas.width = img.width
          pageCanvas.height = Math.min(sourceHeightPerPage, img.height - i * sourceHeightPerPage)

          pageCtx.fillStyle = backgroundColor
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          pageCtx.drawImage(
            canvas,
            0,
            i * sourceHeightPerPage,
            img.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
          )

          const pageImgData = pageCanvas.toDataURL('image/png')
          const pageContentHeight = (pageCanvas.height / img.width) * contentWidth

          pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageContentHeight)
        }
      }

      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const fullFilename = `${filename}_${dateStr}.pdf`

      pdf.save(fullFilename)
      addToast({ type: 'success', message: 'PDF exported successfully' })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      addToast({
        type: 'error',
        message: `PDF 내보내기 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsExporting(false)
    }
  }, [elementRef, isExporting, filename, backgroundColor, orientation, addToast])

  return { isExporting, exportFullPDF }
}
