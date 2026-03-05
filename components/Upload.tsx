import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useOutletContext } from 'react-router';
import { CheckCircle2, UploadIcon, ImageIcon } from 'lucide-react';
import { PROGRESS_INCREMENT, PROGRESS_INTERVAL_MS, REDIRECT_DELAY_MS } from 'lib/constants';

type UploadProps = {
    onComplete?: (base64Data: string) => void;
}

const Upload = ({ onComplete = () => {} }: UploadProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);

    const {isSignedIn} = useOutletContext<AuthContent>();
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearUploadTimers = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        if (redirectTimeoutRef.current) {
            clearTimeout(redirectTimeoutRef.current);
            redirectTimeoutRef.current = null;
        }
    };

    const processFile = (selectedFile: File) => {
        if (!isSignedIn) return;

        clearUploadTimers();
        setFile(selectedFile);
        setProgress(0);

        const reader = new FileReader();

        reader.onload = () => {
            const base64Data = typeof reader.result === 'string' ? reader.result : '';
            if (!base64Data) return;

            progressIntervalRef.current = setInterval(() => {
                setProgress((prevProgress) => {
                    const nextProgress = Math.min(prevProgress + PROGRESS_INCREMENT, 100);

                    if (nextProgress === 100) {
                        clearUploadTimers();
                        redirectTimeoutRef.current = setTimeout(() => {
                            onComplete(base64Data);
                        }, REDIRECT_DELAY_MS);
                    }

                    return nextProgress;
                });
            }, PROGRESS_INTERVAL_MS);
        };

        reader.readAsDataURL(selectedFile);
    };

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!isSignedIn) return;

        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        processFile(selectedFile);
        event.target.value = '';
    };

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isSignedIn) return;
        setIsDragging(true);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isSignedIn) return;
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (!isSignedIn) return;

        const droppedFile = event.dataTransfer.files?.[0];
        if (!droppedFile) return;
        processFile(droppedFile);
    };

    useEffect(() => {
        return () => {
            clearUploadTimers();
        };
    }, []);

    return (
        <div className="upload">
            {!file ? (
                <div
                    className={`dropzone ${isDragging ? 'is-dragging': ''}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input 
                    type="file" 
                    className="drop-input" 
                    accept='.jpg,.jpeg,.png' 
                    disabled={!isSignedIn}
                    onChange={onChange}>
                    </input>
                    <div className="drop-content">
                        <div className="drop-icon">
                            <UploadIcon size={20}></UploadIcon>
                        </div>
                        <p>
                            {
                                isSignedIn ? (
                                    "Click to upload or just drag and drop"
                                ):(
                                    "Sign in or sign up with Puter to upload"
                                )
                            }
                        </p>
                        <p className="help">
                            Maximum file size 50 MB.
                        </p>
                    </div>
                </div>
            ):(
                <div className="upload-status">
                    <div className="status-content">
                        <div className="status-icon">
                            {progress === 100 ? (
                                <CheckCircle2 className="check"></CheckCircle2>  
                            ) : (
                                <ImageIcon className="image"></ImageIcon>
                            )}
                        </div>
                        <h3>{file.name}</h3>
                        <div className="progress">
                            <div className="bar" style={{width: `${progress}%`}}></div>
                            <p className="status-text">
                                {progress < 100 ? 'Analyzing Floor Plan...' : 'Redirecting...'}
                            </p>
                        </div>
                    </div>
                </div>
            )

            }
        </div>
    )
}

export default Upload