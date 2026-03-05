import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useOutletContext } from 'react-router';
import { CheckCircle2, UploadIcon, ImageIcon } from 'lucide-react';
import { PROGRESS_INCREMENT, PROGRESS_INTERVAL_MS, REDIRECT_DELAY_MS } from 'lib/constants';

type UploadProps = {
    onComplete?: (base64Data: string) => void;
}

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'];
const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png';
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

const Upload = ({ onComplete = () => {} }: UploadProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const validateSelectedFile = (selectedFile: File): string | null => {
        if (!ACCEPTED_MIME_TYPES.includes(selectedFile.type)) {
            return 'Only JPG and PNG files are supported.';
        }

        if (selectedFile.size > MAX_UPLOAD_SIZE) {
            return 'File size must be 50 MB or less.';
        }

        return null;
    };

    const processFile = (selectedFile: File) => {
        if (!isSignedIn) return;

        const validationError = validateSelectedFile(selectedFile);
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setErrorMessage(null);
        clearUploadTimers();
        setFile(selectedFile);
        setProgress(0);

        const reader = new FileReader();
        const resetAfterReadFailure = (message: string) => {
            clearUploadTimers();
            setErrorMessage(message);
            setFile(null);
            setProgress(0);
        };

        reader.onerror = () => {
            resetAfterReadFailure('Failed to read the selected file. Please try another image.');
        };

        reader.onabort = () => {
            resetAfterReadFailure('File read was cancelled. Please try again.');
        };

        reader.onload = () => {
            const base64Data = typeof reader.result === 'string' ? reader.result : '';
            if (!base64Data) {
                resetAfterReadFailure('Failed to read the selected file. Please try another image.');
                return;
            }

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

        const validationError = validateSelectedFile(selectedFile);
        if (validationError) {
            setErrorMessage(validationError);
            event.target.value = '';
            return;
        }

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

        const validationError = validateSelectedFile(droppedFile);
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

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
                        accept={ACCEPT_ATTRIBUTE}
                        disabled={!isSignedIn}
                        onChange={onChange}
                    />
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
                        {errorMessage && <p className="help text-red-500">{errorMessage}</p>}
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